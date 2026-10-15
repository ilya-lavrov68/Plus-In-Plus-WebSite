import { redirect } from "next/navigation";

import { OrdersView } from "@/components/orders/orders-view";
import { requireStaff } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/** Очередь заявок. Главная страница рабочего места менеджера. */
export default async function ManagerOrdersPage() {
  const staff = await requireStaff();
  if (!staff) redirect("/");

  return <OrdersView session={staff} basePath="/manager/orders" />;
}
