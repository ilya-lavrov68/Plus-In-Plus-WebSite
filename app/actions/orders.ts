"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
// Заявки ведут и администратор, и менеджер: согласование цены и выставление
// счёта — работа менеджера. Управление сайтом (requireAdmin) тут не нужно.
import { requireStaff } from "@/lib/admin-session";
import { issueInvoice } from "@/lib/payments/invoice";
import { isAuthConfigured } from "@/lib/auth-secret";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/admin-orders";
import { prisma } from "@/lib/prisma";
import { createOrderSchema } from "@/lib/validators";
import {
  calculateServiceSelection,
  canRequestServiceQuote,
} from "@/lib/commerce";

export interface QuoteActionResult {
  ok: boolean;
  orderNumber?: string;
  error?: string;
}

/** Заказ требует входа, поэтому сначала убеждаемся, что аккаунт живой. */
async function requireCustomer(): Promise<{ id: string; email: string } | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id) return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isBlocked: true },
    });
    // Заблокированный аккаунт не может создавать заказы, даже с живым JWT.
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

/**
 * Номер вида ПИП-000123 — его называют клиенту по телефону, поэтому
 * он должен быть коротким и читаемым. Считаем от числа существующих заказов
 * и повторяем при конфликте: два одновременных заказа могут получить
 * одинаковый счётчик.
 */
function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

/**
 * Создаёт заявку на расчёт.
 *
 * Заявка — это НЕ заказ с ценой. Цена здесь только расчётная (estimatedAmount),
 * поле total остаётся нулём, пока менеджер не согласует сумму и не выставит счёт.
 * Поэтому оплата на этом этапе невозможна в принципе.
 *
 * Все цены пересчитываются на сервере: клиент присылает только идентификаторы
 * выбранных опций, а не сумму. Доверять сумме от клиента нельзя.
 */
export async function requestQuote(input: {
  serviceId: string;
  optionIds: string[];
  note?: string;
}): Promise<QuoteActionResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!service || !canRequestServiceQuote(service)) {
    return { ok: false, error: t("serviceNotFound") };
  }

  const estimate = calculateServiceSelection(service, input.optionIds ?? []);
  if (!estimate) return { ok: false, error: t("incompleteOptions") };

  const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";

  // ── Запись ──────────────────────────────────────────────────────────────
  let orderNumber = "";
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence =
        (await prisma.order.count({ where: { status: { not: "cart" } } })) +
        1 +
        attempt;
      orderNumber = formatOrderNumber(sequence);
      try {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              orderNumber,
              number: orderNumber,
              userId: customer.id,
              status: "quote_requested",
              estimatedAmount: estimate.estimatedAmount,
              subtotal: 0,
              discount: 0,
              // Ноль — цену ещё не согласовал менеджер.
              total: 0,
              currency: service.currency,
              customerNote: note || null,
              services: {
                create: {
                  serviceId: service.id,
                  quantity: 1,
                },
              },
              items: {
                create: {
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
              },
            },
          });
          // История пишется в той же транзакции: заявка без следа в журнале
          // действий не должна существовать.
          await recordActivity(tx, {
            action: "create",
            entityType: "order",
            entityId: order.id,
            title: `${order.number} — ${service.title}`,
            actorId: customer.id,
          });

          return order;
        });
        break; // успех
      } catch (error) {
        // Конфликт по номеру — пробуем следующий. Иначе пробрасываем.
        const code = (error as { code?: string })?.code;
        if (code !== "P2002" || attempt === 4) throw error;
      }
    }
  } catch (error) {
    console.error("Failed to create quote request:", error);
    return { ok: false, error: t("genericError") };
  }

  return { ok: true, orderNumber };
}

export interface CreateOrderInput {
  serviceIds: string[];
  deadline?: Date | string | null;
  description?: string;
}

/**
 * Создаёт заказ с выбором одной или нескольких услуг, дедлайном и описанием
 * со страницы /contact.
 *
 * ЖЁСТКОЕ ОГРАНИЧЕНИЕ: запрещено создавать заказ без выбранных услуг.
 * Номер заказа генерируется в формате ПИП-XXXXXX.
 */
export async function createOrder(data: CreateOrderInput) {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) {
    throw new Error(t("unauthorized"));
  }
  if (!prisma) {
    throw new Error(t("genericError"));
  }

  const rawIds = Array.isArray(data?.serviceIds)
    ? data.serviceIds.filter((id): id is string => typeof id === "string")
    : [];
  const parsed = createOrderSchema.safeParse({
    serviceIds: rawIds,
    deadline: data?.deadline,
    description:
      typeof data?.description === "string"
        ? data.description.slice(0, 4000)
        : undefined,
  });
  if (!parsed.success) {
    throw new Error(t("selectAtLeastOneService"));
  }

  const uniqueServiceIds = Array.from(new Set(parsed.data.serviceIds));
  if (uniqueServiceIds.length === 0) {
    throw new Error(t("selectAtLeastOneService"));
  }

  let parsedDeadline: Date | null = null;
  if (
    data?.deadline !== null &&
    data?.deadline !== undefined &&
    data.deadline !== ""
  ) {
    const rawDate =
      data.deadline instanceof Date
        ? data.deadline
        : new Date(String(data.deadline));
    if (Number.isNaN(rawDate.getTime())) {
      throw new Error(t("invalidDeadline"));
    }
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const candidateDay = new Date(rawDate);
    candidateDay.setUTCHours(0, 0, 0, 0);
    if (candidateDay.getTime() < todayStart.getTime()) {
      throw new Error(t("invalidDeadline"));
    }
    parsedDeadline = candidateDay;
  }

  const services = await prisma.service.findMany({
    where: { id: { in: uniqueServiceIds }, isActive: true, isPublished: true },
  });

  if (services.length !== uniqueServiceIds.length) {
    throw new Error(t("serviceInactiveOrMissing"));
  }

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const orderedServices = uniqueServiceIds.map((id) => serviceById.get(id)!);
  const estimatedAmount = orderedServices.reduce(
    (sum, svc) => sum + (svc.basePrice ?? 0),
    0
  );
  const description =
    typeof data?.description === "string"
      ? data.description.trim().slice(0, 4000)
      : "";
  const currency = orderedServices[0]?.currency ?? "RUB";

  let createdOrder: {
    id: string;
    number: string | null;
    orderNumber?: string | null;
    status: string;
    deadline: Date | null;
    description: string | null;
    estimatedAmount: number;
    total: number;
    finalPrice: number | null;
    services: Array<{
      id: string;
      serviceId: string;
      quantity: number;
      service: { id: string; title: string; slug: string; basePrice: number; category: string };
    }>;
  } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sequence =
      (await prisma.order.count({ where: { status: { not: "cart" } } })) +
      1 +
      attempt;
    const orderNumber = formatOrderNumber(sequence);
    try {
      createdOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber,
            number: orderNumber,
            userId: customer.id,
            status: "quote_requested",
            deadline: parsedDeadline,
            description: description || null,
            customerNote: description || null,
            estimatedAmount,
            subtotal: 0,
            discount: 0,
            total: 0,
            finalPrice: null,
            currency,
            services: {
              create: orderedServices.map((svc) => ({
                serviceId: svc.id,
                quantity: 1,
              })),
            },
            items: {
              create: orderedServices.map((svc) => ({
                itemType: "service",
                itemId: svc.id,
                serviceId: svc.id,
                title: svc.title,
                quantity: 1,
                estimatedUnitPrice: svc.basePrice,
                unitPrice: 0,
                totalPrice: 0,
                optionsSnapshot: "[]",
              })),
            },
          },
          include: {
            services: {
              include: {
                service: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    basePrice: true,
                    category: true,
                  },
                },
              },
            },
          },
        });

        await recordActivity(tx, {
          action: "create",
          entityType: "order",
          entityId: order.id,
          title: `${order.number} — ${orderedServices
            .map((svc) => svc.title)
            .join(", ")
            .slice(0, 180)}`,
          actorId: customer.id,
        });

        return order;
      });
      break;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "P2002" || attempt === 4) {
        console.error("Failed to create order:", error);
        throw new Error(t("genericError"));
      }
    }
  }

  if (!createdOrder) {
    throw new Error(t("genericError"));
  }

  revalidatePath("/cart");
  revalidatePath("/admin/orders");
  revalidatePath("/manager/orders");
  revalidatePath("/admin/dashboard");

  const resolvedNumber =
    createdOrder.orderNumber ?? createdOrder.number ?? "";

  return {
    id: createdOrder.id,
    number: resolvedNumber,
    orderNumber: resolvedNumber,
    status: createdOrder.status,
    deadline: createdOrder.deadline,
    description: createdOrder.description,
    estimatedAmount: createdOrder.estimatedAmount,
    total: createdOrder.total,
    finalPrice: createdOrder.finalPrice,
    services: createdOrder.services,
  };
}

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Менеджер фиксирует согласованную цену и выставляет счёт.
 *
 * Именно здесь расчётная цена превращается в реальную: до вызова total равен
 * нулю и заказ оплатить нельзя, после — total заполнен и создаётся платёж.
 *
 * Сумма приходит в рублях строкой (менеджер вводит её в форме), внутри
 * переводится в копейки. Хранить деньги в рублях с плавающей точкой нельзя.
 */
export async function setOrderPrice(input: {
  orderId: string;
  amountRub: string;
  managerNote?: string;
  /** «Зафиксировать цену и заблокировать»: дальше правит только FOUNDER. */
  lock?: boolean;
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const admin = await requireStaff();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const raw = String(input.amountRub ?? "").trim().replace(",", ".");
  // Пустое поле — не «бесплатно». Number("") === 0, поэтому пустоту надо
  // отсечь до преобразования, иначе заявка выставится на 0 ₽.
  if (!raw) return { ok: false, error: t("invalidAmount") };
  const rubles = Number(raw);
  if (!Number.isFinite(rubles) || rubles < 0) return { ok: false, error: t("invalidAmount") };
  // Ограничение сверху: опечатка вроде лишнего нуля не должна пройти в счёт.
  if (rubles > 100_000_000) return { ok: false, error: t("invalidAmount") };
  const total = Math.round(rubles * 100);

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    // Почта нужна, чтобы Робокасса сама заполнила её в форме оплаты.
    include: {
      items: true,
      user: { select: { email: true } },
      payments: { where: { status: "succeeded" }, select: { id: true }, take: 1 },
    },
  });
  if (!order || order.status === "cart") return { ok: false, error: t("orderNotFound") };
  if (["paid", "in_progress", "completed", "cancelled", "refunded"].includes(order.status)) {
    return { ok: false, error: t("orderClosed") };
  }
  // Статус мог устареть или быть изменён вне webhook: фактический успешный
  // платёж в любом случае делает согласованную сумму неизменной.
  if ((order.payments?.length ?? 0) > 0) {
    return { ok: false, error: t("orderPriceLocked") };
  }
  // ЖЁСТКОЕ ПРАВИЛО: заблокированный заказ редактирует только основатель.
  // Проверка на сервере, а не только дизейбл полей в UI: форму можно обойти.
  if (order.isLocked && !admin.isFounder) {
    return { ok: false, error: t("orderLocked") };
  }

  const note = typeof input.managerNote === "string" ? input.managerNote.trim().slice(0, 2000) : "";
  const now = new Date();
  const lockNow = input.lock === true && !order.isLocked;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          payments: { none: { status: "succeeded" } },
        },
        data: {
          total,
          finalPrice: total / 100,
          subtotal: total,
          status: "awaiting_payment",
          managerId: admin.id,
          managerNote: note || null,
          priceAgreedAt: now,
          // «Зафиксировать цену и заблокировать» — одним действием, чтобы не
          // было окна, в котором счёт уже у клиента, а цену ещё можно менять.
          ...(lockNow ? { isLocked: true, lockedAt: now, lockedById: admin.id } : {}),
        },
      });
      if (result.count !== 1) return false;

      // Согласованная цена раскладывается по позициям пропорционально их
      // расчётной стоимости: скидка или наценка менеджера распределяется,
      // а не прибивается к первой позиции.
      const estimatedTotal = order.items.reduce(
        (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
        0,
      );
      for (const item of order.items) {
        const share = estimatedTotal
          ? (item.estimatedUnitPrice * item.quantity) / estimatedTotal
          : 1 / Math.max(1, order.items.length);
        const itemTotal = Math.round(total * share);
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            unitPrice: item.quantity ? Math.round(itemTotal / item.quantity) : itemTotal,
            totalPrice: itemTotal,
          },
        });
      }

      // Счёт. Ссылку даёт платёжный провайдер; если он не настроен, счёт
      // всё равно остаётся в базе — историю платежей терять не должны.
      const resolvedOrderNumber =
        order.orderNumber ?? order.number ?? order.id;
      const invoice = await issueInvoice({
        orderId: order.id,
        orderNumber: resolvedOrderNumber,
        amount: total,
        currency: order.currency,
        customerEmail: order.user?.email ?? null,
      }, tx);
      // A payment may have succeeded while the manager edited the price.
      // Never commit a new agreed amount without its corresponding invoice.
      if (!invoice) throw new Error("Invoice could not be issued");

      await recordActivity(tx, {
        action: "priced",
        entityType: "order",
        entityId: order.id,
        title: `${resolvedOrderNumber} — ${(total / 100).toLocaleString("ru-RU")} ₽`,
        actorId: admin.id,
      });

      if (lockNow) {
        await recordActivity(tx, {
          action: "locked",
          entityType: "order",
          entityId: order.id,
          title: `${resolvedOrderNumber} — заблокирован для редактирования`,
          actorId: admin.id,
        });
      }

      return true;
    });
    if (!updated) return { ok: false, error: t("orderPriceLocked") };
  } catch (error) {
    console.error("Failed to set the order price:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/manager/orders/${order.id}`);
  revalidatePath("/manager/orders");
  revalidatePath("/cart");
  return { ok: true };
}

/** Перевод заказа в следующий статус вручную (например, «в работу»). */
export async function updateOrderStatus(input: {
  orderId: string;
  status: string;
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const admin = await requireStaff();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  if (!ORDER_STATUSES.includes(input.status as OrderStatus)) {
    return { ok: false, error: t("invalidStatus") };
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      payments: { where: { status: "succeeded" }, select: { id: true }, take: 1 },
    },
  });
  if (!order || order.status === "cart") return { ok: false, error: t("orderNotFound") };

  // Заблокированный заказ трогает только основатель — включая статус:
  // иначе замок обходили бы сменой статуса вместо цены.
  if (order.isLocked && !admin.isFounder) {
    return { ok: false, error: t("orderLocked") };
  }

  // Оплаченные статусы выставляет только платёжный webhook: менеджер не
  // должен иметь возможности отметить заказ оплаченным вручную.
  if (input.status === "paid" && order.status !== "paid") {
    return { ok: false, error: t("paidOnlyByPayment") };
  }
  if (input.status === order.status) return { ok: true };

  const transitions: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
    pending: ["quote_requested", "negotiating", "cancelled"],
    quote_requested: ["negotiating", "cancelled"],
    negotiating: ["quote_requested", "cancelled"],
    priced: ["awaiting_payment", "negotiating", "cancelled"],
    awaiting_payment: ["negotiating", "cancelled"],
    paid: ["in_progress"],
    in_progress: ["completed"],
    completed: [],
    cancelled: [],
    refunded: [],
  };
  const currentStatus = order.status as OrderStatus;
  const nextStatus = input.status as OrderStatus;
  if (!transitions[currentStatus]?.includes(nextStatus)) {
    return { ok: false, error: t("invalidOrderTransition") };
  }

  const paymentRequired = nextStatus === "in_progress" || nextStatus === "completed";
  if (paymentRequired && order.payments.length === 0) {
    return { ok: false, error: t("paymentRequiredForProgress") };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          ...(paymentRequired ? { payments: { some: { status: "succeeded" } } } : {}),
        },
        data: { status: nextStatus },
      });
      if (result.count !== 1) return false;
      await recordActivity(tx, {
        action: "updated",
        entityType: "order",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — ${nextStatus}`,
        actorId: admin.id,
      });
      return true;
    });
    if (!updated) {
      return {
        ok: false,
        error: t(paymentRequired ? "paymentRequiredForProgress" : "invalidOrderTransition"),
      };
    }
  } catch (error) {
    console.error("Failed to update the order status:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

/**
 * Блокировка заказа от редактирования — отдельным действием, без смены цены.
 *
 * Заблокировать может любой сотрудник (менеджер фиксирует условия сделки).
 * Разблокировать — ТОЛЬКО основатель: именно в этом смысл замка, иначе
 * менеджер снимал бы его сам перед каждой правкой.
 */
export async function setOrderLocked(input: {
  orderId: string;
  locked: boolean;
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const admin = await requireStaff();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };
  if (typeof input.locked !== "boolean") return { ok: false, error: t("genericError") };

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order || order.status === "cart") return { ok: false, error: t("orderNotFound") };
  if (order.isLocked === input.locked) return { ok: true };

  if (!input.locked && !admin.isFounder) {
    return { ok: false, error: t("orderLocked") };
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    return { ok: false, error: t("orderClosed") };
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: input.locked
          ? { isLocked: true, lockedAt: now, lockedById: admin.id }
          : { isLocked: false, lockedAt: null, lockedById: null },
      });
      await recordActivity(tx, {
        action: input.locked ? "locked" : "unlocked",
        entityType: "order",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — ${input.locked ? "заблокирован для редактирования" : "разблокирован основателем"}`,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to change the order lock:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/manager/orders/${order.id}`);
  revalidatePath("/manager/orders");
  return { ok: true };
}

/**
 * Статусы, на которых клиент ещё может отменить заказ самостоятельно:
 * цена либо не согласована, либо счёт выставлен, но не оплачен.
 */
const CUSTOMER_CANCELLABLE_STATUSES: readonly string[] = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
];

/**
 * Отмена собственного заказа клиентом.
 *
 * Заказ и корзина — одна и та же сущность, поэтому отменяется именно строка
 * заказа, а не «заявка» где-то рядом: статус становится `cancelled`, и заказ
 * сразу виден как отменённый и клиенту, и менеджеру.
 *
 * Отменить можно только свой заказ и только пока он не оплачен и не взят в
 * работу. Проверка владельца и отсутствие успешного платежа повторяются в
 * самом `updateMany` — между чтением и записью мог пройти webhook оплаты.
 */
export async function cancelMyOrder(input: {
  orderId: string;
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const orderId = typeof input?.orderId === "string" ? input.orderId.trim() : "";
  if (!orderId) return { ok: false, error: t("orderNotFound") };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { where: { status: "succeeded" }, select: { id: true }, take: 1 },
    },
  });
  // Чужой заказ неотличим от несуществующего: одинаковый ответ, без утечки id.
  if (!order || order.userId !== customer.id || order.status === "cart") {
    return { ok: false, error: t("orderNotFound") };
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return { ok: false, error: t("orderClosed") };
  }
  // Оплату отменяет и возвращает только менеджер — не клиент одной кнопкой.
  if (order.status === "paid" || (order.payments?.length ?? 0) > 0) {
    return { ok: false, error: t("cancelPaidOrder") };
  }
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    return { ok: false, error: t("cancelStartedOrder") };
  }

  const orderNumber = order.orderNumber ?? order.number ?? order.id;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: order.id,
          userId: customer.id,
          status: order.status,
          payments: { none: { status: "succeeded" } },
        },
        data: { status: "cancelled" },
      });
      if (result.count !== 1) return false;

      await recordActivity(tx, {
        action: "cancelled",
        entityType: "order",
        entityId: order.id,
        title: `${orderNumber} — отменён клиентом`,
        actorId: customer.id,
      });
      return true;
    });
    if (!updated) return { ok: false, error: t("cancelFailed") };
  } catch (error) {
    console.error("Failed to cancel the order:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/manager/orders/${order.id}`);
  revalidatePath("/manager/orders");
  return { ok: true };
}
