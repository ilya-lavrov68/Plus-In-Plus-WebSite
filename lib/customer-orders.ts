import { auth } from "@/auth";
import { getPayloadClient, payloadDate, payloadId } from "@/lib/payload-native";
import type { Order, OrderItem, OrderService, Payment } from "@/payload/payload-types";

export interface CustomerOrderItem { id: string; itemType: string; itemId: string; title: string; quantity: number; totalPrice: number; estimatedUnitPrice: number }
export interface CustomerOrderServiceLink { id: string; serviceId: string; quantity: number; service: { id: string; title: string; slug: string; basePrice: number; category: string } }
export interface CustomerInvoice { id: string; status: string; amount: number; paymentUrl: string | null; createdAt: Date; paidAt: Date | null }
export interface CustomerOrder {
  id: string; orderNumber: string; number: string; status: string; estimatedAmount: number; total: number;
  finalPrice: number | null; currency: string; deadline: Date | null; description: string | null;
  customerNote: string | null; managerNote: string | null; isLocked: boolean; createdAt: Date; paidAt: Date | null;
  items: CustomerOrderItem[]; services: CustomerOrderServiceLink[]; invoices: CustomerInvoice[];
}

/** Читает заказы клиента четырьм bounded queries, без N+1 по позициям и платежам. */
export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "orders", depth: 0, pagination: false, sort: "-createdAt", overrideAccess: true,
      where: { and: [{ userId: { equals: userId } }, { status: { not_equals: "cart" } }] },
    });
    const orders = result.docs as Order[];
    if (!orders.length) return [];
    const ids = orders.map((order) => order.id);
    const [itemResult, serviceResult, paymentResult] = await Promise.all([
      payload.find({ collection: "order-items", depth: 1, pagination: false, overrideAccess: true, where: { orderId: { in: ids } } }),
      payload.find({ collection: "order-services", depth: 1, pagination: false, overrideAccess: true, where: { orderId: { in: ids } } }),
      payload.find({ collection: "payments", depth: 0, pagination: false, sort: "-createdAt", overrideAccess: true, where: { orderId: { in: ids } } }),
    ]);
    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const item of itemResult.docs as OrderItem[]) {
      const id = payloadId(item.orderId)!;
      itemsByOrder.set(id, [...(itemsByOrder.get(id) ?? []), item]);
    }
    const servicesByOrder = new Map<string, OrderService[]>();
    for (const link of serviceResult.docs as OrderService[]) {
      const id = payloadId(link.orderId)!;
      servicesByOrder.set(id, [...(servicesByOrder.get(id) ?? []), link]);
    }
    const paymentsByOrder = new Map<string, Payment[]>();
    for (const payment of paymentResult.docs as Payment[]) {
      const id = payloadId(payment.orderId)!;
      paymentsByOrder.set(id, [...(paymentsByOrder.get(id) ?? []), payment]);
    }

    return orders.map((order) => {
      const displayNumber = order.orderNumber ?? order.number ?? order.id;
      return {
        id: order.id,
        orderNumber: displayNumber,
        number: displayNumber,
        status: order.status,
        estimatedAmount: order.estimatedAmount,
        total: order.total,
        finalPrice: order.finalPrice ?? null,
        currency: order.currency,
        deadline: payloadDate(order.deadline),
        description: order.description ?? null,
        customerNote: order.customerNote ?? null,
        managerNote: order.managerNote ?? null,
        isLocked: Boolean(order.isLocked),
        createdAt: payloadDate(order.createdAt) ?? new Date(0),
        paidAt: payloadDate(order.paidAt),
        items: (itemsByOrder.get(order.id) ?? []).map((item) => {
          const service = typeof item.serviceId === "object" ? item.serviceId : null;
          const product = typeof item.productId === "object" ? item.productId : null;
          return {
            id: item.id,
            itemType: item.itemType || "service",
            itemId: item.itemId || "",
            title: item.title || service?.title || product?.name || item.itemId || "—",
            quantity: item.quantity,
            totalPrice: item.totalPrice ?? 0,
            estimatedUnitPrice: item.estimatedUnitPrice > 0 ? item.estimatedUnitPrice : item.itemType === "product" && product ? Math.round(product.price * 100) : service?.basePrice ?? 0,
          };
        }),
        services: (servicesByOrder.get(order.id) ?? []).map((link) => {
          const service = typeof link.serviceId === "object" ? link.serviceId : null;
          return {
            id: link.id,
            serviceId: payloadId(link.serviceId) ?? "",
            quantity: link.quantity,
            service: service ?? { id: payloadId(link.serviceId) ?? "", title: "", slug: "", basePrice: 0, category: "small" },
          };
        }),
        invoices: (paymentsByOrder.get(order.id) ?? []).map((payment) => ({
          id: payment.id, status: payment.status, amount: payment.amount, paymentUrl: payment.paymentUrl ?? null,
          createdAt: payloadDate(payment.createdAt) ?? new Date(0), paidAt: payloadDate(payment.paidAt),
        })),
      };
    });
  } catch (error) {
    console.error("Failed to load the customer orders:", error);
    return [];
  }
}
