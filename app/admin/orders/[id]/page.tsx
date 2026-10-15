import { redirect } from "next/navigation";

import { OrderDetailView } from "@/components/orders/order-detail-view";
import { requireAdmin } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return <OrderDetailView orderId={id} basePath="/admin/orders" />;
}
