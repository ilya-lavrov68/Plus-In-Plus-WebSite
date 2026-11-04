"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { findAccountById, isUniqueConstraintError, recordActivity } from "@/lib/accounts";
import { getActionTranslator } from "@/lib/action-i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { calculateServiceSelection, canRequestServiceQuote } from "@/lib/commerce";
import {
  countOrdersExceptCart,
  countPaymentsByStatus,
  findOrderById,
  insertOrder,
  insertOrderItem,
  replaceOrderServices,
  transitionOrder,
} from "@/lib/commerce-data";
import { withTransaction, type DbTransaction } from "@/lib/db";
import { findServiceById, getServicesByIds } from "@/lib/data";
import { notifyNewOrder } from "@/lib/notifications";
import { createOrderSchema } from "@/lib/validators";

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
    const account = await findAccountById(session.user.id);
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

async function nextOrderNumber(attempt: number): Promise<string> {
  return formatOrderNumber((await countOrdersExceptCart()) + 1 + attempt);
}

async function writeOrderActivity(
  tx: DbTransaction,
  data: { action: string; entityId: string; title: string; actorId: string | null },
): Promise<void> {
  await recordActivity({ ...data, entityType: "order" }, tx);
}

/** Клиентская заявка на расчёт по конкретной услуге. */
export async function requestQuote(input: {
  serviceId: string;
  optionIds: string[];
  note?: string;
}): Promise<QuoteActionResult> {
  const t = await getActionTranslator();
  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };

  try {
    const service = typeof input?.serviceId === "string" ? await findServiceById(input.serviceId, { withOptions: true }) : null;
    if (!service || !canRequestServiceQuote(service)) return { ok: false, error: t("serviceNotFound") };
    const estimate = calculateServiceSelection(service, input.optionIds ?? []);
    if (!estimate) return { ok: false, error: t("incompleteOptions") };
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";
    let orderNumber = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      orderNumber = await nextOrderNumber(attempt);
      try {
        await withTransaction(async (tx) => {
          const order = await insertOrder({
            userId: customer.id,
            status: "quote_requested",
            orderNumber,
            number: orderNumber,
            estimatedAmount: estimate.estimatedAmount,
            subtotal: 0,
            discount: 0,
            total: 0,
            currency: service.currency,
            customerNote: note || null,
          }, tx);
          await replaceOrderServices(order.id, [{ serviceId: service.id, quantity: 1 }], tx);
          await insertOrderItem({
            orderId: order.id,
            itemType: "service",
            itemId: service.id,
            serviceId: service.id,
            title: service.title,
            quantity: 1,
            estimatedUnitPrice: estimate.estimatedAmount,
            optionsSnapshot: JSON.stringify(estimate.selected),
          }, tx);
          await writeOrderActivity(tx, {
            action: "create",
            entityId: order.id,
            title: `${orderNumber} — ${service.title}`,
            actorId: customer.id,
          });
        });
        break;
      } catch (error) {
        if (!isUniqueConstraintError(error) || attempt === 4) throw error;
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

/** Публичная форма /contact: одна транзакция на заказ, услуги и позиции. */
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

  const found = await getServicesByIds(uniqueServiceIds);
  const available = found.filter((service) => service.isActive && service.isPublished);
  if (available.length !== uniqueServiceIds.length) throw new Error(t("serviceInactiveOrMissing"));
  const serviceById = new Map(available.map((service) => [service.id, service]));
  const orderedServices = uniqueServiceIds.map((id) => serviceById.get(id)!);
  const estimatedAmount = orderedServices.reduce((sum, service) => sum + (service.basePrice ?? 0), 0);
  const description = typeof data?.description === "string" ? data.description.trim().slice(0, 4000) : "";
  const currency = orderedServices[0]?.currency ?? "RUB";

  let created: { id: string; orderNumber: string; status: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = await nextOrderNumber(attempt);
    try {
      created = await withTransaction(async (tx) => {
        const order = await insertOrder({
          userId: customer.id,
          status: "quote_requested",
          orderNumber,
          number: orderNumber,
          deadline: parsedDeadline ?? null,
          description: description || null,
          customerNote: description || null,
          estimatedAmount,
          subtotal: 0,
          discount: 0,
          total: 0,
          currency,
        }, tx);
        await replaceOrderServices(
          order.id,
          orderedServices.map((service) => ({ serviceId: service.id, quantity: 1 })),
          tx,
        );
        for (const service of orderedServices) {
          await insertOrderItem({
            orderId: order.id,
            itemType: "service",
            itemId: service.id,
            serviceId: service.id,
            title: service.title,
            quantity: 1,
            estimatedUnitPrice: service.basePrice,
            optionsSnapshot: "[]",
          }, tx);
        }
        await writeOrderActivity(tx, {
          action: "create",
          entityId: order.id,
          title: `${orderNumber} — ${orderedServices.map((service) => service.title).join(", ").slice(0, 180)}`,
          actorId: customer.id,
        });
        return { id: order.id, orderNumber, status: order.status };
      });
      break;
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 4) {
        console.error("Failed to create order:", error);
        throw new Error(t("genericError"));
      }
    }
  }
  if (!created) throw new Error(t("genericError"));

  // Уведомление в Telegram — best-effort: заявка уже сохранена, поэтому сбой
  // доставки не превращается в ошибку оформления, но и не теряется молча.
  try {
    await notifyNewOrder({
      orderNumber: created.orderNumber,
      services: orderedServices.map((service) => service.title),
      amount: estimatedAmount,
      customerEmail: customer.email,
      deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
    });
  } catch (error) {
    console.warn("[orders] notification failed", (error as Error)?.name ?? "unknown");
  }

  revalidatePath("/cart");
  return {
    id: created.id,
    number: created.orderNumber,
    orderNumber: created.orderNumber,
    status: created.status,
    deadline: parsedDeadline,
    description: description || null,
    estimatedAmount,
    total: 0,
    finalPrice: null,
    services: orderedServices.map((service) => ({
      id: `${created!.id}:${service.id}`,
      serviceId: service.id,
      quantity: 1,
      service: {
        id: service.id,
        title: service.title,
        slug: service.slug,
        basePrice: service.basePrice,
        priceType: service.priceType,
        currency: service.currency,
        category: service.category,
        isOrderable: service.isOrderable,
      },
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
    const outcome = await withTransaction(async (tx) => {
      const order = await findOrderById(orderId, tx);
      if (!order || order.userId !== customer.id || order.status === "cart") return "not-found" as const;
      if (order.status === "cancelled" || order.status === "refunded") return "closed" as const;
      if (order.status === "paid") return "paid" as const;
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) return "started" as const;
      if ((await countPaymentsByStatus(order.id, "succeeded", tx)) > 0) return "paid" as const;
      if (!(await transitionOrder(order.id, order.status, { status: "cancelled" }, tx))) return "failed" as const;
      await writeOrderActivity(tx, {
        action: "cancelled",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — отменён клиентом`,
        actorId: customer.id,
      });
      return "ok" as const;
    });
    if (outcome === "not-found") return { ok: false, error: t("orderNotFound") };
    if (outcome === "closed") return { ok: false, error: t("orderClosed") };
    if (outcome === "started") return { ok: false, error: t("cancelStartedOrder") };
    if (outcome === "paid") return { ok: false, error: t("cancelPaidOrder") };
    if (outcome !== "ok") return { ok: false, error: t("cancelFailed") };
  } catch (error) {
    console.error("Failed to cancel the order:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true };
}
