import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { auth } from "@/auth";
import { getCustomerOrders } from "@/lib/customer-orders";
import { formatKopecks } from "@/lib/pricing";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("orders");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

/**
 * Заказы клиента.
 *
 * Здесь же и оплата: менеджер согласовал цену и выставил счёт — появляется
 * кнопка. Пока цены нет, показываем расчёт и объясняем, что сумму уточняет
 * менеджер: заказ не оплатить до договорённости, и это надо показать честно,
 * а не рисовать недоступную кнопку.
 */
export default async function CustomerOrdersPage() {
  const [session, t] = await Promise.all([auth(), getRequestTranslations("orders")]);
  if (!session?.user?.id) redirect("/?auth=login");

  const orders = await getCustomerOrders();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      {!orders.length ? (
        <div className="mt-10">
          <EmptyState icon={FileText} title={t("emptyTitle")} description={t("emptyBody")} />
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href="/shop">{t("toShop")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {orders.map((order) => {
            const priced = order.total > 0;
            const currency = order.currency || "RUB";
            // Оплатить можно только актуальный счёт. Прошлые неудачные
            // попытки кнопку не получают.
            const payable = order.invoices.find(
              (invoice) => invoice.status === "pending" && invoice.paymentUrl,
            );

            return (
              <li key={order.id}>
                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-lg">{order.number}</CardTitle>
                    <OrderStatusBadge status={order.status} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("created")}</dt>
                        <dd className="text-sm font-medium">{formatDate(order.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("estimate")}</dt>
                        <dd className="text-sm font-medium tabular-nums">
                          {formatKopecks(order.estimatedAmount, currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("agreed")}</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {priced ? formatKopecks(order.total, currency) : "—"}
                        </dd>
                      </div>
                    </dl>

                    {order.items.length ? (
                      <ul className="space-y-1 border-t border-border pt-3 text-sm">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">
                              {item.title}
                              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {item.totalPrice
                                ? formatKopecks(item.totalPrice, currency)
                                : formatKopecks(item.estimatedUnitPrice * item.quantity, currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {order.managerNote ? (
                      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span className="font-medium">{t("managerComment")}: </span>
                        {order.managerNote}
                      </p>
                    ) : null}

                    {!priced ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {t("waitingForPrice")}
                      </p>
                    ) : null}

                    {payable ? (
                      <Button asChild className="bg-[#00C56D] text-[#052B42] hover:bg-[#00B361]">
                        <a href={payable.paymentUrl ?? undefined}>
                          {t("pay")} {formatKopecks(payable.amount, currency)}
                        </a>
                      </Button>
                    ) : priced && order.status === "awaiting_payment" ? (
                      // Счёт есть, ссылки нет: провайдер не настроен.
                      <p className="text-sm text-muted-foreground">{t("invoicePending")}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
