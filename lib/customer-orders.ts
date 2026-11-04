import { auth } from "@/auth";
import {
  listOrderItemsForOrders,
  listOrderServicesForOrders,
  listOrdersForUser,
  listPaymentsForOrders,
  type PaymentRecord,
} from "@/lib/commerce-data";
import { getServicesByIds } from "@/lib/data";

export interface CustomerOrderItem { id: string; itemType: string; itemId: string; title: string; quantity: number; totalPrice: number; estimatedUnitPrice: number }
export interface CustomerOrderServiceLink { id: string; serviceId: string; quantity: number; service: { id: string; title: string; slug: string; basePrice: number; category: string } }
export interface CustomerInvoice { id: string; status: string; amount: number; paymentUrl: string | null; createdAt: Date; paidAt: Date | null }
export interface CustomerOrder {
  id: string; orderNumber: string; number: string; status: string; estimatedAmount: number; total: number;
  finalPrice: number | null; currency: string; deadline: Date | null; description: string | null;
  customerNote: string | null; managerNote: string | null; isLocked: boolean; createdAt: Date; paidAt: Date | null;
  items: CustomerOrderItem[]; services: CustomerOrderServiceLink[]; invoices: CustomerInvoice[];
}

/**
 * Заказы клиента: четыре bounded-запроса (заказы, позиции, связи услуг,
 * счета) без N+1. Названия услуг добираются одним запросом по id.
 */
export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  try {
    const orders = await listOrdersForUser(userId);
    if (!orders.length) return [];
    const ids = orders.map((order) => order.id);
    const [items, links, payments] = await Promise.all([
      listOrderItemsForOrders(ids),
      listOrderServicesForOrders(ids),
      listPaymentsForOrders(ids),
    ]);
    const services = await getServicesByIds([...new Set(links.map((link) => link.serviceId))]);
    const serviceMap = new Map(services.map((service) => [service.id, service]));

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
    const servicesByOrder = new Map<string, typeof links>();
    for (const link of links) servicesByOrder.set(link.orderId, [...(servicesByOrder.get(link.orderId) ?? []), link]);
    const paymentsByOrder = new Map<string, PaymentRecord[]>();
    for (const payment of payments) paymentsByOrder.set(payment.orderId, [...(paymentsByOrder.get(payment.orderId) ?? []), payment]);

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
        deadline: order.deadline,
        description: order.description ?? null,
        customerNote: order.customerNote ?? null,
        managerNote: order.managerNote ?? null,
        isLocked: order.isLocked,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        items: (itemsByOrder.get(order.id) ?? []).map((item) => {
          const service = item.serviceId ? serviceMap.get(item.serviceId) : undefined;
          return {
            id: item.id,
            itemType: item.itemType || "service",
            itemId: item.itemId || "",
            title: item.title || service?.title || item.itemId || "—",
            quantity: item.quantity,
            totalPrice: item.totalPrice ?? 0,
            estimatedUnitPrice: item.estimatedUnitPrice > 0 ? item.estimatedUnitPrice : service?.basePrice ?? 0,
          };
        }),
        services: (servicesByOrder.get(order.id) ?? []).map((link) => {
          const service = serviceMap.get(link.serviceId);
          return {
            id: link.id,
            serviceId: link.serviceId,
            quantity: link.quantity,
            service: service
              ? { id: service.id, title: service.title, slug: service.slug, basePrice: service.basePrice, category: service.category }
              : { id: link.serviceId, title: "", slug: "", basePrice: 0, category: "small" },
          };
        }),
        invoices: (paymentsByOrder.get(order.id) ?? []).map((payment) => ({
          id: payment.id, status: payment.status, amount: payment.amount, paymentUrl: payment.paymentUrl ?? null,
          createdAt: payment.createdAt, paidAt: payment.paidAt,
        })),
      };
    });
  } catch (error) {
    console.error("Failed to load the customer orders:", error);
    return [];
  }
}
