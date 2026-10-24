import { redirect } from "next/navigation";

import { OrdersView } from "@/components/orders/orders-view";
import { requireAdmin } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

interface AdminOrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Заявки в части администратора. Та же реализация, что у менеджера. */
export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");
  const query = await searchParams;

  // Администратор — тоже сотрудник, поэтому ему доступно всё то же.
  return (
    <OrdersView
      session={{ ...admin, isAdmin: true }}
      basePath="/admin/orders"
      requestedPage={query.page}
    />
  );
}
