import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Hourglass, Receipt, TrendingUp } from "lucide-react";

import { OrdersTable } from "@/components/admin/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOrders, getOrderStats } from "@/lib/admin-orders";
import { requireAdmin } from "@/lib/admin-session";
import { formatKopecks } from "@/lib/pricing";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [admin, t] = await Promise.all([requireAdmin(), getRequestTranslations("admin")]);
  if (!admin) redirect("/");

  const [orders, stats] = await Promise.all([getAdminOrders(), getOrderStats()]);

  const cards = [
    {
      title: t("ordersQueue"),
      icon: Hourglass,
      value: String(stats.queue),
      detail: t("ordersSubtitle"),
      // Ждущие заявки — то, что требует действий прямо сейчас.
      highlight: stats.queue > 0,
    },
    {
      title: t("ordersRevenue"),
      icon: TrendingUp,
      value: formatKopecks(stats.revenue),
      detail: t("postsCount", { count: stats.paidCount }),
      highlight: false,
    },
    {
      title: t("ordersAverage"),
      icon: Receipt,
      value: formatKopecks(stats.averageOrder),
      detail: t("status_paid"),
      highlight: false,
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("orders")}</h1>
      <p className="mt-2 text-muted-foreground">{t("ordersSubtitle")}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ title, icon: Icon, value, detail, highlight }) => (
          <Card key={title} className={highlight ? "border-amber-300 bg-amber-50/50" : undefined}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        {orders.length ? (
          <OrdersTable
            orders={orders.map((order) => ({
              id: order.id,
              number: order.number,
              status: order.status,
              estimatedAmount: order.estimatedAmount,
              total: order.total,
              currency: order.currency,
              customerEmail: order.customer.email,
              createdAt: order.createdAt,
            }))}
            // Только те статусы, что реально встретились: пустые пилюли в
            // фильтре засоряют панель.
            statuses={[...new Set(orders.map((order) => order.status))]}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 hover:underline">
          {t("dashboard")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </p>
    </div>
  );
}
