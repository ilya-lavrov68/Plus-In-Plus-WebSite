import { redirect } from "next/navigation";

import { OrderDetailView } from "@/components/admin/order-detail-view";
import { requireStaff } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function ManagerOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const staff = await requireStaff();
  if (!staff) redirect("/");

  return <OrderDetailView orderId={id} basePath="/manager/orders" />;
}
