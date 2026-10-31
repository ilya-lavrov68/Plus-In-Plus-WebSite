import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";

import { OrderPriceForm } from "@/components/orders/order-price-form";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { OrdersBasePath } from "@/components/orders/orders-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOrder } from "@/lib/admin-orders";
import { requireStaff } from "@/lib/admin-session";
import { formatKopecks } from "@/lib/pricing";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getRequestLocale } from "@/lib/request-locale";

/** Выбранные опции клиента: [{ group, option, ... }] → «Тираж: 100 шт». */
interface OptionSnapshotEntry {
  groupName?: string;
  optionLabel?: string;
  group?: string;
  option?: string;
}

function readOptions(snapshot: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const item = entry as OptionSnapshotEntry;
    const label = item.optionLabel ?? item.option;
    if (!label) return [];
    const group = item.groupName ?? item.group;
    return [group ? `${group}: ${label}` : String(label)];
  });
}

function formatDate(value: Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function formatDateOnly(value: Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

/**
 * Карточка заявки: расчёт, согласованная цена, выбранные опции и счета.
 * Одна реализация для администратора и менеджера.
 */
export async function OrderDetailView({
  orderId,
  basePath,
}: {
  orderId: string;
  basePath: OrdersBasePath;
}) {
  const [t, locale] = await Promise.all([
    getRequestTranslations("admin"),
    getRequestLocale(),
  ]);

  // Кто смотрит карточку: заблокированный заказ правит только основатель.
  // Страница и так за гардами /admin и /manager, здесь роль нужна форме.
  const staff = await requireStaff();
  const canEditLocked = Boolean(staff?.isFounder);

  const order = await getAdminOrder(orderId);
  if (!order) notFound();

  const priced = order.total > 0;
  const currency = order.currency || "RUB";
  const hasSuccessfulPayment = order.payments.some((payment) => payment.status === "succeeded");
  const priceChangeClosed = hasSuccessfulPayment ||
    ["paid", "in_progress", "completed", "cancelled", "refunded"].includes(order.status);

  return (
    <div>
      <Link
        href={basePath}
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        {t("backToOrders")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        {order.isLocked ? (
          <Badge variant="outline" className="gap-1.5">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            {t("orderLockedBadge")}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("created")}: {formatDate(order.createdAt, locale)}
        {order.priceAgreedAt ? ` · ${t("agreed")}: ${formatDate(order.priceAgreedAt, locale)}` : ""}
        {order.paidAt ? ` · ${t("status_paid")}: ${formatDate(order.paidAt, locale)}` : ""}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          {/* Цена — главное действие по заявке, поэтому она первой. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("priceSection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-sm text-muted-foreground">{t("estimated")}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatKopecks(order.estimatedAmount, currency, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("agreed")}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {priced ? formatKopecks(order.total, currency, locale) : "—"}
                  </p>
                </div>
              </div>

              {!priced ? (
                <p className="rounded-xl border border-amber-500/35 bg-amber-500/15 px-3.5 py-2.5 text-sm text-amber-200">
                  {t("notPricedYet")}
                </p>
              ) : null}

              {priceChangeClosed ? (
                <p className="rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
                  {t("priceLockedAfterPayment")}
                </p>
              ) : (
                <OrderPriceForm
                  orderId={order.id}
                  estimatedAmount={order.estimatedAmount}
                  currentTotal={order.total}
                  currentNote={order.managerNote}
                  currency={currency}
                  isLocked={order.isLocked}
                  canEditLocked={canEditLocked}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("orderDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-border">
                {order.items.map((item) => {
                  const options = readOptions(item.optionsSnapshot);
                  return (
                    <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {item.title}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </p>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {item.unitPrice
                            ? formatKopecks(item.totalPrice, currency, locale)
                            : `${t("estimated")} ${formatKopecks(item.estimatedUnitPrice * item.quantity, currency, locale)}`}
                        </p>
                      </div>
                      {options.length ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {options.map((option, index) => (
                            <li key={`${option}-${index}`} className="text-sm text-muted-foreground">
                              {option}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">{t("deadline")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.deadline ? formatDateOnly(order.deadline, locale) : t("noDeadline")}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t("customerWishes")}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {order.description || order.customerNote || t("noCustomerNote")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("customer")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="break-all font-medium">{order.customer.email}</p>
              {order.customer.firstName || order.customer.lastName ? (
                <p className="text-muted-foreground">
                  {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("payments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.payments.length ? (
                <ul className="divide-y divide-border text-sm">
                  {order.payments.map((payment) => (
                    <li key={payment.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="tabular-nums">
                          {formatKopecks(payment.amount, payment.currency, locale)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {/* Провайдер и статус сырые: это служебные данные,
                              их не нужно переводить. */}
                          {payment.provider} · {payment.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(payment.createdAt, locale)}
                      </p>
                      {payment.paymentUrl ? (
                        <a
                          href={payment.paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs underline underline-offset-4"
                        >
                          {t("invoiceLink")}
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("invoicePending")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
              )}

              {/* Оплата по согласованной цене: маршрут сам достанет или
                  создаст счёт и уведёт на форму Робокассы. */}
              {order.status === "awaiting_payment" && priced && !hasSuccessfulPayment ? (
                <form method="POST" action="/api/payment/create" className="mt-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <button
                    type="submit"
                    className={`${buttonVariants({ variant: "default", size: "sm" })} w-full`}
                  >
                    {t("payNow")}
                  </button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
