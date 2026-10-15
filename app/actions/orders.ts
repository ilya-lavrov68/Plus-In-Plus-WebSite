"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { isAuthConfigured } from "@/lib/auth-secret";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/admin-orders";
import { prisma } from "@/lib/prisma";
import { calculateEstimate } from "@/lib/pricing";

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
    where: { id: input.serviceId, isPublished: true, isOrderable: true },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!service) return { ok: false, error: t("serviceNotFound") };

  // ── Проверка присланных опций ────────────────────────────────────────────
  // Клиент может прислать что угодно: чужие optionId, две опции из одной
  // группы, опции от другой услуги. Всё это отбрасывается здесь — до того,
  // как числа попадут в расчёт.
  const validOptionIds = new Set(
    service.optionGroups.flatMap((group) => group.options.map((option) => option.id)),
  );
  const requestedIds = (input.optionIds ?? []).filter((id) => typeof id === "string");

  const chosenByGroup = new Map<string, string>();
  for (const optionId of requestedIds) {
    if (!validOptionIds.has(optionId)) continue; // чужая опция — игнорируем
    const group = service.optionGroups.find((candidate) =>
      candidate.options.some((option) => option.id === optionId),
    );
    if (!group) continue;
    // Первая опция в группе побеждает: дубликаты отбрасываются.
    if (!chosenByGroup.has(group.id)) chosenByGroup.set(group.id, optionId);
  }

  // Обязательные группы должны быть заполнены — иначе расчёт неполный.
  for (const group of service.optionGroups) {
    if (!group.required) continue;
    if (chosenByGroup.has(group.id)) continue;
    const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
    if (!fallback) return { ok: false, error: t("incompleteOptions") };
    chosenByGroup.set(group.id, fallback.id);
  }

  const estimate = calculateEstimate(
    { basePrice: service.basePrice, priceType: service.priceType, groups: service.optionGroups },
    [...chosenByGroup.values()],
  );
  if (!estimate.complete) return { ok: false, error: t("incompleteOptions") };

  const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";

  // ── Запись ──────────────────────────────────────────────────────────────
  let orderNumber = "";
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = (await prisma.order.count()) + 1 + attempt;
      orderNumber = formatOrderNumber(sequence);
      try {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
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
              items: {
                create: {
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
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const admin = await requireAdmin();
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
    include: { items: true },
  });
  if (!order) return { ok: false, error: t("orderNotFound") };
  if (order.status === "cancelled" || order.status === "refunded") {
    return { ok: false, error: t("orderClosed") };
  }

  const note = typeof input.managerNote === "string" ? input.managerNote.trim().slice(0, 2000) : "";
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          total,
          subtotal: total,
          status: "awaiting_payment",
          managerId: admin.id,
          managerNote: note || null,
          priceAgreedAt: now,
        },
      });

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

      // Счёт. Ссылки на оплату пока нет — её сгенерирует платёжный провайдер,
      // когда будет подключён. Платеж создаётся сразу, чтобы у заказа была
      // история попыток, даже если ссылку получить не удалось.
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "robokassa",
          externalId: null,
          status: "pending",
          amount: total,
          currency: order.currency,
          paymentUrl: null,
        },
      });

      await recordActivity(tx, {
        action: "priced",
        entityType: "order",
        entityId: order.id,
        title: `${order.number} — ${(total / 100).toLocaleString("ru-RU")} ₽`,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to set the order price:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

/** Перевод заказа в следующий статус вручную (например, «в работу»). */
export async function updateOrderStatus(input: {
  orderId: string;
  status: string;
}): Promise<OrderActionResult> {
  const t = await getActionTranslator();

  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  if (!ORDER_STATUSES.includes(input.status as OrderStatus)) {
    return { ok: false, error: t("invalidStatus") };
  }

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) return { ok: false, error: t("orderNotFound") };

  // Оплаченные статусы выставляет только платёжный webhook: менеджер не
  // должен иметь возможности отметить заказ оплаченным вручную.
  if (input.status === "paid" && order.status !== "paid") {
    return { ok: false, error: t("paidOnlyByPayment") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: input.status } });
      await recordActivity(tx, {
        action: "updated",
        entityType: "order",
        entityId: order.id,
        title: `${order.number} — ${input.status}`,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to update the order status:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
