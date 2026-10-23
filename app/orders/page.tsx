import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, FileText, Plus, XCircle } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { auth } from "@/auth";
import { getCustomerOrders } from "@/lib/customer-orders";
import { formatKopecks } from "@/lib/pricing";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getPublishedServices } from "@/lib/data";
import { mergeCatalogServices } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("orders");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Дата заказа в языке интерфейса: «22 окт. 2026 г.» для русского и
 * «Oct 22, 2026» для английского. Часовой пояс фиксированный (UTC), чтобы
 * дата не «прыгала» между сервером и клиентом.
 */
function formatDate(value: Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/** Цена ещё не согласована менеджером — оплатить заказ нельзя. */
function isUnpriced(status: string, total: number): boolean {
  return total <= 0 || status === "quote_requested" || status === "negotiating";
}

/** Заказ закрыт: отклонён или возвращён. */
function isClosed(status: string): boolean {
  return status === "cancelled" || status === "refunded";
}

/** Заказ оплачен и находится в работе после оплаты. */
function isPaid(status: string): boolean {
  return status === "paid" || status === "in_progress" || status === "completed";
}

/**
 * Заказы клиента.
 *
 * Статус согласования цены показывается явно, честно и одним из четырёх
 * состояний:
 *
 *  - цена не согласована (pending)   — янтарный блок «менеджер уточняет цену»,
 *    кнопки оплаты нет, потому что платить ещё не за что;
 *  - цена согласована (priced)       — показываем согласованную сумму и кнопку оплаты,
 *    когда платёжная ссылка готова;
 *  - оплачен (paid)                  — зелёный блок «Оплачен. Спасибо!»;
 *  - отклонён (cancelled)            — красный блок с предложением связаться
 *    с нами.
 *
 * Счёт к оплате только один — самый свежий в статусе pending и с ссылкой.
 * Прошлые неудачные попытки оплаты кнопку не получают.
 */
export default async function CustomerOrdersPage() {
  const [session, t, locale] = await Promise.all([
    auth(),
    getRequestTranslations("orders"),
    getRequestLocale(),
  ]);
  if (!session?.user?.id) redirect("/login");

  const [orders, dbServices] = await Promise.all([
    getCustomerOrders(),
    getPublishedServices(),
  ]);
  // Заявки создаются в конфигураторе услуги: «Новая заявка» ведёт туда.
  // Раздел Shop скрыт из навигации, но страницы услуг продолжают работать.
  const firstServiceSlug = mergeCatalogServices(dbServices)[0]?.slug;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      {!orders.length ? (
        <div className="mt-10">
          <EmptyState icon={FileText} title={t("emptyTitle")} description={t("emptyBody")} />
          {firstServiceSlug ? (
            <div className="mt-6 text-center">
              <Button asChild variant="outline">
                <Link href={`/shop/${firstServiceSlug}`}>{t("newRequest")}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {orders.map((order) => {
            const priced = order.total > 0;
            const currency = order.currency || "RUB";
            const unpriced = isUnpriced(order.status, order.total);
            const closed = isClosed(order.status);
            const paid = isPaid(order.status);
            // Оплатить можно только актуальный счёт. Прошлые неудачные
            // попытки кнопку не получают.
            const payable = order.invoices.find(
              (invoice) => invoice.status === "pending" && invoice.paymentUrl,
            );
            // Счёт есть, ссылки нет: провайдер не настроен.
            const invoiceWaiting = !unpriced && !payable && order.status === "awaiting_payment";

            return (
              <li key={order.id}>
                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-lg">{order.number}</CardTitle>
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      {firstServiceSlug ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/shop/${firstServiceSlug}`}>
                            <Plus aria-hidden="true" className="size-3.5" />
                            {t("newRequest")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-sm text-muted-foreground">{t("created")}</dt>
                        <dd className="text-sm font-medium">{formatDate(order.createdAt, locale)}</dd>
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

                    {/* Цена ещё не согласована: без кнопки оплаты. */}
                    {unpriced && !closed ? (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
                        <p className="text-sm text-amber-800">{t("waitingForPrice")}</p>
                      </div>
                    ) : null}

                    {/* Цена согласована: тот же блок плюс кнопка оплаты. */}
                    {order.status === "awaiting_payment" ? (
                      <>
                        {payable ? (
                          // Белая кнопка оплаты: на тёмной теме читается как
                          // «основное действие» и выделяется на фоне карточки.
                          <Button
                            asChild
                            className="w-fit border border-primary-foreground/20 bg-white px-4 py-2 text-primary-foreground hover:bg-white/90 hover:text-primary-foreground"
                          >
                            <a href={payable.paymentUrl ?? undefined}>
                              {t("pay")} {formatKopecks(payable.amount, currency)}
                            </a>
                          </Button>
                        ) : null}
                        {invoiceWaiting ? (
                          <p className="text-sm text-muted-foreground">{t("invoicePending")}</p>
                        ) : null}
                      </>
                    ) : null}

                    {/* Оплачен: благодарим и больше ничего не требуем. */}
                    {paid ? (
                      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                        <p className="text-sm text-emerald-800">{t("paidThanks")}</p>
                      </div>
                    ) : null}

                    {/* Отклонён или возвращён: объясняем, как связаться. */}
                    {closed ? (
                      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
                        <p className="text-sm text-red-800">{t("declined")}</p>
                      </div>
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
