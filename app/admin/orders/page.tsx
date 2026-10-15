import { redirect } from "next/navigation";

import { OrdersView } from "@/components/admin/orders-view";
import { requireAdmin } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/** Заявки в части администратора. Та же реализация, что у менеджера. */
export default async function AdminOrdersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  // Администратор — тоже сотрудник, поэтому ему доступно всё то же.
  return <OrdersView session={{ ...admin, isAdmin: true }} basePath="/admin/orders" />;
}
