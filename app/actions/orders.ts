"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { calculateServiceSelection, canRequestServiceQuote } from "@/lib/commerce";
import {
  getPayloadClient,
  isPayloadUniqueError,
  payloadDate,
  payloadId,
  withPayloadTransaction,
} from "@/lib/payload-native";
import { createOrderSchema } from "@/lib/validators";
import type { Order, OrderService, Service } from "@/payload/payload-types";

type CreatedOrder = Omit<Order, "services"> & { services: OrderService[] };

export interface QuoteActionResult {
  ok: boolean;
  orderNumber?: string;
  error?: string;
}

async function requireCustomer(): Promise<{ id: string; email: string } | null> {
  try {
    if (!isAuthConfigured()) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "accounts",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { id: { equals: session.user.id } },
    });
    const account = result.docs[0];
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

async function nextOrderNumber(payload: Awaited<ReturnType<typeof getPayloadClient>>, attempt: number): Promise<string> {
  const result = await payload.count({
    collection: "orders",
    overrideAccess: true,
    where: { status: { not_equals: "cart" } },
  });
  return formatOrderNumber(result.totalDocs + 1 + attempt);
}

async function writeOrderActivity(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  req: Parameters<Parameters<typeof withPayloadTransaction>[1]>[0],
  data: { action: string; entityId: string; title: string; actorId: string | null },
) {
  await payload.create({
    collection: "activity-logs",
    data: { action: data.action, entityType: "order", entityId: data.entityId, title: data.title, actorId: data.actorId },
    overrideAccess: true,
    req,
  });
}

/** Клиентская заявка на расчёт; manager price/invoice живут в Payload Orders. */
export async function requestQuote(input: {
  serviceId: string;
  optionIds: string[];
  note?: string;
}): Promise<QuoteActionResult> {
  const t = await getActionTranslator();
  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "services",
      depth: 2,
      limit: 1,
      overrideAccess: true,
      where: { id: { equals: input.serviceId } },
    });
    const service = result.docs[0] as Service | undefined;
    if (!service || !canRequestServiceQuote(service)) return { ok: false, error: t("serviceNotFound") };
    const estimate = calculateServiceSelection(service, input.optionIds ?? []);
    if (!estimate) return { ok: false, error: t("incompleteOptions") };
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";
    let orderNumber = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      orderNumber = await nextOrderNumber(payload, attempt);
      try {
        await withPayloadTransaction(payload, async (req) => {
          const order = await payload.create({
            collection: "orders",
            data: {
              orderNumber,
              number: orderNumber,
              userId: customer.id,
              status: "quote_requested",
              estimatedAmount: estimate.estimatedAmount,
              subtotal: 0,
              discount: 0,
              total: 0,
              currency: service.currency,
              customerNote: note || null,
            },
            depth: 0,
            overrideAccess: true,
            req,
          });
          await payload.create({
            collection: "order-services",
            data: { orderId: order.id, serviceId: service.id, quantity: 1 },
            overrideAccess: true,
            req,
          });
          await payload.create({
            collection: "order-items",
            data: {
              orderId: order.id,
              itemType: "service",
              itemId: service.id,
              serviceId: service.id,
              title: service.title,
              quantity: 1,
              estimatedUnitPrice: estimate.estimatedAmount,
              unitPrice: 0,
              totalPrice: 0,
              optionsSnapshot: JSON.stringify(estimate.selected),
            },
            overrideAccess: true,
            req,
          });
          await writeOrderActivity(payload, req, {
            action: "create",
            entityId: order.id,
            title: `${orderNumber} — ${service.title}`,
            actorId: customer.id,
          });
        });
        break;
      } catch (error) {
        if (!isPayloadUniqueError(error) || attempt === 4) throw error;
      }
    }
    revalidatePath("/cart");
    return { ok: true, orderNumber };
  } catch (error) {
    console.error("Failed to create quote request:", error);
    return { ok: false, error: t("genericError") };
  }
}

export interface CreateOrderInput {
  serviceIds: string[];
  deadline?: Date | string | null;
  description?: string;
}

/** Публичная форма /contact: только native Payload documents и transactions. */
export async function createOrder(data: CreateOrderInput) {
  const t = await getActionTranslator();
  const customer = await requireCustomer();
  if (!customer) throw new Error(t("unauthorized"));

  const rawIds = Array.isArray(data?.serviceIds)
    ? data.serviceIds.filter((id): id is string => typeof id === "string")
    : [];
  const parsed = createOrderSchema.safeParse({
    serviceIds: rawIds,
    deadline: data?.deadline,
    description: typeof data?.description === "string" ? data.description.slice(0, 4000) : undefined,
  });
  if (!parsed.success) throw new Error(t("selectAtLeastOneService"));
  const uniqueServiceIds = Array.from(new Set(parsed.data.serviceIds));
  if (uniqueServiceIds.length === 0) throw new Error(t("selectAtLeastOneService"));

  let parsedDeadline: Date | null = null;
  if (data?.deadline !== null && data?.deadline !== undefined && data.deadline !== "") {
    const rawDate = data.deadline instanceof Date ? data.deadline : new Date(String(data.deadline));
    if (Number.isNaN(rawDate.getTime())) throw new Error(t("invalidDeadline"));
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const candidateDay = new Date(rawDate);
    candidateDay.setUTCHours(0, 0, 0, 0);
    if (candidateDay.getTime() < todayStart.getTime()) throw new Error(t("invalidDeadline"));
    parsedDeadline = candidateDay;
  }

  const payload = await getPayloadClient();
  const serviceResult = await payload.find({
    collection: "services",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    where: { and: [{ id: { in: uniqueServiceIds } }, { isActive: { equals: true } }, { isPublished: { equals: true } }] },
  });
  const services = serviceResult.docs as Service[];
  if (services.length !== uniqueServiceIds.length) throw new Error(t("serviceInactiveOrMissing"));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const orderedServices = uniqueServiceIds.map((id) => serviceById.get(id)!);
  const estimatedAmount = orderedServices.reduce((sum, service) => sum + (service.basePrice ?? 0), 0);
  const description = typeof data?.description === "string" ? data.description.trim().slice(0, 4000) : "";
  const currency = orderedServices[0]?.currency ?? "RUB";

  let createdOrder: CreatedOrder | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = await nextOrderNumber(payload, attempt);
    try {
      createdOrder = await withPayloadTransaction(payload, async (req) => {
        const order = await payload.create({
          collection: "orders",
          data: {
            orderNumber,
            number: orderNumber,
            userId: customer.id,
            status: "quote_requested",
            deadline: parsedDeadline?.toISOString() ?? null,
            description: description || null,
            customerNote: description || null,
            estimatedAmount,
            subtotal: 0,
            discount: 0,
            total: 0,
            finalPrice: null,
            currency,
          },
          depth: 0,
          overrideAccess: true,
          req,
        });
        const links: OrderService[] = [];
        for (const service of orderedServices) {
          const link = await payload.create({
            collection: "order-services",
            data: { orderId: order.id, serviceId: service.id, quantity: 1 },
            depth: 1,
            overrideAccess: true,
            req,
          });
          links.push(link);
          await payload.create({
            collection: "order-items",
            data: {
              orderId: order.id,
              itemType: "service",
              itemId: service.id,
              serviceId: service.id,
              title: service.title,
              quantity: 1,
              estimatedUnitPrice: service.basePrice,
              unitPrice: 0,
              totalPrice: 0,
              optionsSnapshot: "[]",
            },
            overrideAccess: true,
            req,
          });
        }
        await writeOrderActivity(payload, req, {
          action: "create",
          entityId: order.id,
          title: `${orderNumber} — ${orderedServices.map((service) => service.title).join(", ").slice(0, 180)}`,
          actorId: customer.id,
        });
        return { ...order, services: links };
      });
      break;
    } catch (error) {
      if (!isPayloadUniqueError(error) || attempt === 4) {
        console.error("Failed to create order:", error);
        throw new Error(t("genericError"));
      }
    }
  }
  if (!createdOrder) throw new Error(t("genericError"));

  revalidatePath("/cart");
  const resolvedNumber = createdOrder.orderNumber ?? createdOrder.number ?? "";
  return {
    id: createdOrder.id,
    number: resolvedNumber,
    orderNumber: resolvedNumber,
    status: createdOrder.status,
    deadline: payloadDate(createdOrder.deadline),
    description: createdOrder.description,
    estimatedAmount: createdOrder.estimatedAmount,
    total: createdOrder.total,
    finalPrice: createdOrder.finalPrice,
    services: createdOrder.services.map((link) => ({
      id: link.id,
      serviceId: payloadId(link.serviceId) ?? "",
      quantity: link.quantity,
      service: orderedServices.find((service) => service.id === payloadId(link.serviceId)) ?? null,
    })),
  };
}

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

const CUSTOMER_CANCELLABLE_STATUSES: readonly string[] = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
];

/** Отмена собственного заказа с атомарной проверкой владельца и оплаты. */
export async function cancelMyOrder(input: { orderId: string }): Promise<OrderActionResult> {
  const t = await getActionTranslator();
  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  const orderId = typeof input?.orderId === "string" ? input.orderId.trim() : "";
  if (!orderId) return { ok: false, error: t("orderNotFound") };

  try {
    const payload = await getPayloadClient();
    const updated = await withPayloadTransaction(payload, async (req) => {
      const result = await payload.find({
        collection: "orders",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
        where: { id: { equals: orderId } },
      });
      const order = result.docs[0] as Order | undefined;
      if (!order || payloadId(order.userId) !== customer.id || order.status === "cart") return "not-found" as const;
      if (order.status === "cancelled" || order.status === "refunded") return "closed" as const;
      if (order.status === "paid") return "paid" as const;
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) return "started" as const;
      const paid = await payload.count({
        collection: "payments",
        overrideAccess: true,
        req,
        where: { and: [{ orderId: { equals: order.id } }, { status: { equals: "succeeded" } }] },
      });
      if (paid.totalDocs > 0) return "paid" as const;
      const changed = await payload.update({
        collection: "orders",
        data: { status: "cancelled" },
        overrideAccess: true,
        req,
        where: { and: [{ id: { equals: order.id } }, { userId: { equals: customer.id } }, { status: { equals: order.status } }] },
      });
      if (changed.docs.length !== 1) return "failed" as const;
      await writeOrderActivity(payload, req, {
        action: "cancelled",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — отменён клиентом`,
        actorId: customer.id,
      });
      return "ok" as const;
    });
    if (updated === "not-found") return { ok: false, error: t("orderNotFound") };
    if (updated === "closed") return { ok: false, error: t("orderClosed") };
    if (updated === "started") return { ok: false, error: t("cancelStartedOrder") };
    if (updated === "paid") return { ok: false, error: t("cancelPaidOrder") };
    if (updated !== "ok") return { ok: false, error: t("cancelFailed") };
  } catch (error) {
    console.error("Failed to cancel the order:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  return { ok: true };
}
