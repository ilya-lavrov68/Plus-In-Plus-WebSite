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
  currency: string;
  customerNote: string | null;
  managerNote: string | null;
  createdAt: Date;
  paidAt: Date | null;
  items: CustomerOrderItem[];
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
        currency: true,
        customerNote: true,
        managerNote: true,
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
    return orders.map(({ payments, ...order }) => ({ ...order, invoices: payments }));
  } catch (error) {
    console.error("Failed to load the customer orders:", error);
    return [];
  }
}
