import { countPaymentsByStatus, findOrderById, transitionOrder } from "@/lib/commerce-data";
import { ORDER_STATUSES } from "@/lib/order-status";

/**
 * Правила жизненного цикла заказа.
 *
 * Раньше их держали `beforeChange`-хуки Payload. После отказа от CMS они живут
 * здесь и вызываются только из серверных действий админки: успешную оплату
 * по-прежнему подтверждает единственный писатель — webhook Robokassa, а не
 * сотрудник.
 */

export type StaffRole = "FOUNDER" | "ADMIN" | "MANAGER";

/** Допустимые переходы: остальное — ошибка оператора, а не «гибкость». */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
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

/** Статусы, в которых заказ считается закрытым: цена и состав уже неизменны. */
export const CLOSED_ORDER_STATUSES: readonly string[] = ["paid", "in_progress", "completed", "cancelled", "refunded"];

/** Статусы, для которых нужен подтверждённый платёж. */
const PAID_ONLY_STATUSES: readonly string[] = ["in_progress", "completed"];

export class OrderRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRuleError";
  }
}

export async function changeOrderStatus(input: {
  orderId: string;
  status: string;
  actor: { id: string; role: StaffRole };
}): Promise<void> {
  const { orderId, status, actor } = input;
  if (!(ORDER_STATUSES as readonly string[]).includes(status) || status === "cart") {
    throw new OrderRuleError("Неизвестный статус заказа.");
  }

  const order = await findOrderById(orderId);
  if (!order) throw new OrderRuleError("Заказ не найден.");
  if (order.status === status) return;

  // Корзина — это заказ клиента, а не запись админки.
  if (order.status === "cart") throw new OrderRuleError("Корзина редактируется только клиентским сценарием.");
  if (order.isLocked && actor.role !== "FOUNDER") {
    throw new OrderRuleError("Заблокированный заказ может изменить только основатель.");
  }
  if (status === "paid") {
    throw new OrderRuleError("Оплату подтверждает только webhook Robokassa.");
  }
  if (!ORDER_TRANSITIONS[order.status]?.includes(status)) {
    throw new OrderRuleError(`Недопустимый переход ${order.status} → ${status}.`);
  }
  if (PAID_ONLY_STATUSES.includes(status) && (await countPaymentsByStatus(order.id, "succeeded")) === 0) {
    throw new OrderRuleError("Для работы по заказу нужен успешный платёж.");
  }

  // Условный UPDATE: если статус успели сменить параллельно, изменение не «затрёт» его.
  const changed = await transitionOrder(order.id, order.status, { status });
  if (!changed) throw new OrderRuleError("Статус заказа уже изменился, обновите страницу.");
}
