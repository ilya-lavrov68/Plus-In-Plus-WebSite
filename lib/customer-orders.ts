import { auth } from "@/auth";

import { prisma } from "@/lib/prisma";

export interface CustomerOrderItem {
  id: string;
  title: string;
  quantity: number;
  /** Согласованная цена позиции, копейки. 0, пока цены нет. */
  totalPrice: number;
  estimatedUnitPrice: number;
}

export interface CustomerOrderServiceLink {
  id: string;
  serviceId: string;
  quantity: number;
  service: {
    id: string;
    title: string;
    slug: string;
    basePrice: number;
    category: string;
  };
}

export interface CustomerInvoice {
  id: string;
  status: string;
  amount: number;
  /** Ссылка на форму оплаты. Есть не всегда — провайдер может быть не настроен. */
  paymentUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface CustomerOrder {
  id: string;
  number: string;
  status: string;
  /** Расчётная цена, копейки — ориентир, а не счёт. */
  estimatedAmount: number;
  /** Согласованная менеджером цена, копейки. 0 — цена ещё не названа. */
  total: number;
  /** Итоговая цена в рублях, если зафиксирована менеджером. */
  finalPrice: number | null;
  currency: string;
  deadline: Date | null;
  description: string | null;
  customerNote: string | null;
  managerNote: string | null;
  isLocked: boolean;
  createdAt: Date;
  paidAt: Date | null;
  items: CustomerOrderItem[];
  services: CustomerOrderServiceLink[];
  invoices: CustomerInvoice[];
}

/**
 * Заказы вошедшего пользователя.
 *
 * Идентификатор берётся только из сессии — ни из параметров, ни из формы.
 * Иначе, подставив чужой id, можно было бы вытащить чужие заказы и адреса
 * оплаты. Для чтения чужих данных есть отдельный слой lib/admin-orders.ts,
 * и он доступен только сотрудникам.
 */
export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return [];

  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        estimatedAmount: true,
        total: true,
        finalPrice: true,
        currency: true,
        deadline: true,
        description: true,
        customerNote: true,
        managerNote: true,
        isLocked: true,
        createdAt: true,
        paidAt: true,
        items: {
          select: {
            id: true,
            title: true,
            quantity: true,
            totalPrice: true,
            estimatedUnitPrice: true,
          },
        },
        services: {
          select: {
            id: true,
            serviceId: true,
            quantity: true,
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
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amount: true,
            paymentUrl: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });
    // В схеме связь называется payments, для клиента понятнее «счета».
    return orders.map(({ payments, items, services, ...order }) => ({
      ...order,
      finalPrice: order.finalPrice ?? null,
      deadline: order.deadline ?? null,
      description: order.description ?? null,
      isLocked: Boolean(order.isLocked),
      items: items ?? [],
      services: services ?? [],
      invoices: payments ?? [],
    }));
  } catch (error) {
    console.error("Failed to load the customer orders:", error);
    return [];
  }
}
