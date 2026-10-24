import { redirect } from "next/navigation";

import { OrdersView } from "@/components/orders/orders-view";
import { requireStaff } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

interface ManagerOrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Очередь заявок. Главная страница рабочего места менеджера. */
export default async function ManagerOrdersPage({ searchParams }: ManagerOrdersPageProps) {
  const staff = await requireStaff();
  if (!staff) redirect("/");
  const query = await searchParams;

  return (
    <OrdersView
      session={staff}
      basePath="/manager/orders"
      requestedPage={query.page}
    />
  );
}
