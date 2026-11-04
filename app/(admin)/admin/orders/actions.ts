"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { ORDER_STATUSES } from "@/lib/order-status";
import { OrderRuleError, changeOrderStatus } from "@/lib/order-guards";

/**
 * Смена статуса заказа. Доступна только ADMIN/FOUNDER, статус сверяется с
 * жизненным циклом из lib/order-status.ts, каждое изменение попадает в журнал
 * активности.
 */
export async function updateOrderStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!orderId || !(ORDER_STATUSES as readonly string[]).includes(status)) return;

  try {
    await changeOrderStatus({ orderId, status, actor: { id: admin.id, role: admin.role } });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      console.warn(`[admin] order status rejected: ${error.message}`);
      return;
    }
    throw error;
  }
  await logAdminAction({
    action: "order.status_changed",
    entityType: "order",
    entityId: orderId,
    title: `Статус заказа ${orderId.slice(0, 8)} → ${status}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}
