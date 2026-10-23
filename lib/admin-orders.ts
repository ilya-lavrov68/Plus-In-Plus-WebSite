import { prisma } from "@/lib/prisma";

/**
 * Заказы и заявки со стороны админки.
 *
 * Отдельный модуль от lib/orders.ts (клиентской части), чтобы административные
 * запросы — которые видят чужие заказы, письма и примечания менеджера —
 * никогда не подтягивались в публичные страницы.
 *
 * Все функции деградируют в пустой результат и не бросают исключений:
 * админка должна показать пустое состояние, а не упасть.
 */

/** Статусы в том порядке, в котором заказ по ним идёт. */
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

/** Статусы, на которых цена ещё не зафиксирована менеджером. */
export const UNPRICED_STATUSES: readonly string[] = [
  "pending",
  "quote_requested",
  "negotiating",
];

/** Статусы, на которых заказ считается оплаченным для отчётов о выручке. */
export const REVENUE_STATUSES: readonly string[] = ["paid", "in_progress", "completed"];

export interface AdminOrderItemView {
  id: string;
  title: string;
  quantity: number;
  estimatedUnitPrice: number;
  unitPrice: number;
  totalPrice: number;
  /** Что именно выбрал клиент. JSON-строка, разбирается на месте. */
  optionsSnapshot: string;
}

export interface AdminPaymentView {
  id: string;
  provider: string;
  externalId: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface AdminOrderView {
  id: string;
  number: string;
  status: string;
  estimatedAmount: number;
  discount: number;
  total: number;
  currency: string;
  deadline: Date | null;
  description: string | null;
  finalPrice: number | null;
  customerNote: string | null;
  managerNote: string | null;
  /** Заблокирован от редактирования: править может только FOUNDER. */
  isLocked: boolean;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  priceAgreedAt: Date | null;
  paidAt: Date | null;
  customer: { id: string; email: string; firstName: string | null; lastName: string | null };
  manager: { id: string; email: string } | null;
  items: AdminOrderItemView[];
  services: Array<{
    id: string;
    quantity: number;
    service: { id: string; title: string; slug: string; basePrice: number };
  }>;
  payments: AdminPaymentView[];
}

type OrderRow = {
  id: string;
  orderNumber?: string | null;
  number: string | null;
  status: string;
  estimatedAmount: number;
  discount: number;
  total: number;
  currency: string;
  deadline?: Date | null;
  description?: string | null;
  finalPrice?: number | null;
  customerNote: string | null;
  managerNote: string | null;
  isLocked?: boolean;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  priceAgreedAt: Date | null;
  paidAt: Date | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  manager: { id: string; email: string } | null;
  items: AdminOrderItemView[];
  services?: Array<{
    id: string;
    quantity: number;
    service: { id: string; title: string; slug: string; basePrice: number };
  }>;
  payments: AdminPaymentView[];
};

function toAdminOrderView(row: OrderRow): AdminOrderView {
  const displayNumber = row.orderNumber ?? row.number ?? row.id;
  return {
    id: row.id,
    number: displayNumber,
    status: row.status,
    estimatedAmount: row.estimatedAmount,
    discount: row.discount,
    total: row.total,
    currency: row.currency,
    deadline: row.deadline ?? null,
    description: row.description ?? null,
    finalPrice: row.finalPrice ?? null,
    customerNote: row.customerNote,
    managerNote: row.managerNote,
    isLocked: Boolean(row.isLocked),
    lockedAt: row.lockedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    priceAgreedAt: row.priceAgreedAt,
    paidAt: row.paidAt,
    // Аккаунт мог быть удалён, хотя заказ остаётся — не роняем страницу.
    customer: row.user ?? { id: "", email: "— удалён —", firstName: null, lastName: null },
    manager: row.manager,
    items: row.items ?? [],
    services: row.services ?? [],
    payments: row.payments ?? [],
  };
}

const orderInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  manager: { select: { id: true, email: true } },
  items: {
    select: {
      id: true,
      title: true,
      quantity: true,
      estimatedUnitPrice: true,
      unitPrice: true,
      totalPrice: true,
      optionsSnapshot: true,
    },
  },
  services: {
    select: {
      id: true,
      quantity: true,
      service: {
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      provider: true,
      externalId: true,
      status: true,
      amount: true,
      currency: true,
      paymentUrl: true,
      createdAt: true,
      paidAt: true,
    },
  },
};

export async function getAdminOrders(): Promise<AdminOrderView[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.order.findMany({
      where: { status: { not: "cart" } },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });
    return rows.map((row) => toAdminOrderView(row as OrderRow));
  } catch (error) {
    console.error("Failed to load orders:", error);
    return [];
  }
}

/** Заказ по id или номеру (ПИП-000123) — менеджеры ищут по номеру. */
export async function getAdminOrder(idOrNumber: string): Promise<AdminOrderView | null> {
  if (!prisma) return null;
  try {
    const row = await prisma.order.findFirst({
      where: {
        status: { not: "cart" },
        OR: [
          { id: idOrNumber },
          { number: idOrNumber },
          { orderNumber: idOrNumber },
        ],
      },
      include: orderInclude,
    });
    return row ? toAdminOrderView(row as OrderRow) : null;
  } catch (error) {
    console.error("Failed to load the order:", error);
    return null;
  }
}

export interface OrderStats {
  /** Сколько заявок ждёт решения менеджера. */
  queue: number;
  /** Выручка по оплаченным заказам, копейки. */
  revenue: number;
  /** Средний чек по оплаченным заказам, копейки. 0, если считать нечего. */
  averageOrder: number;
  paidCount: number;
}

export async function getOrderStats(): Promise<OrderStats> {
  const empty: OrderStats = { queue: 0, revenue: 0, averageOrder: 0, paidCount: 0 };
  if (!prisma) return empty;

  try {
    const [queue, paid] = await Promise.all([
      prisma.order.count({ where: { status: { in: [...UNPRICED_STATUSES] } } }),
      prisma.order.findMany({
        where: { status: { in: [...REVENUE_STATUSES] } },
        select: { total: true },
      }),
    ]);

    const revenue = paid.reduce((sum, order) => sum + order.total, 0);
    return {
      queue,
      revenue,
      paidCount: paid.length,
      averageOrder: paid.length ? Math.round(revenue / paid.length) : 0,
    };
  } catch (error) {
    console.error("Failed to load order stats:", error);
    return empty;
  }
}
