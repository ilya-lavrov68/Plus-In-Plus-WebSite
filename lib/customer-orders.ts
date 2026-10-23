import { auth } from "@/auth";

import { prisma } from "@/lib/prisma";

export interface CustomerOrderItem {
  id: string;
  itemType: string;
  itemId: string;
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
  paymentUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  number: string;
  status: string;
  estimatedAmount: number;
  total: number;
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
 * Оформленные заказы вошедшего пользователя (все кроме черновика корзины `status='cart'`).
 */
export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return [];

  try {
    const orders = await prisma.order.findMany({
      where: { userId, status: { not: "cart" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
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
            itemType: true,
            itemId: true,
            title: true,
            quantity: true,
            totalPrice: true,
            estimatedUnitPrice: true,
            service: { select: { title: true, basePrice: true } },
            product: { select: { name: true, price: true } },
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

    return orders
      .filter((order) => order.status !== "cart")
      .map(({ payments, items, services, ...order }) => {
        const displayNumber =
          order.orderNumber ?? order.number ?? order.id;
        return {
          ...order,
          orderNumber: displayNumber,
          number: displayNumber,
          finalPrice: order.finalPrice ?? null,
          deadline: order.deadline ?? null,
          description: order.description ?? null,
          isLocked: Boolean(order.isLocked),
          items: (items ?? []).map((item) => {
            const resolvedTitle =
              item.title ||
              item.service?.title ||
              item.product?.name ||
              item.itemId ||
              "—";
            const fallbackEstKopecks =
              item.estimatedUnitPrice > 0
                ? item.estimatedUnitPrice
                : item.itemType === "product" && item.product
                  ? Math.round(item.product.price * 100)
                  : item.service?.basePrice ?? 0;
            return {
              id: item.id,
              itemType: item.itemType || "service",
              itemId: item.itemId || "",
              title: resolvedTitle,
              quantity: item.quantity,
              totalPrice: item.totalPrice ?? 0,
              estimatedUnitPrice: fallbackEstKopecks,
            };
          }),
          services: services ?? [],
          invoices: payments ?? [],
        };
      });
  } catch (error) {
    console.error("Failed to load the customer orders:", error);
    return [];
  }
}
