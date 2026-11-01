/** Статусы в порядке жизненного цикла заказа. */
export const ORDER_STATUSES = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const UNPRICED_STATUSES: readonly string[] = ["pending", "quote_requested", "negotiating"];
export const REVENUE_STATUSES: readonly string[] = ["paid", "in_progress", "completed"];
