"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  Plus,
  Wrench,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cancelMyOrder } from "@/app/actions/orders";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import type { CustomerOrder } from "@/lib/customer-orders";
import { formatKopecks } from "@/lib/pricing";

export interface OrderCardProps {
  order: CustomerOrder;
}

function formatDate(value: Date | string | null, locale: string): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function isUnpriced(status: string, total: number): boolean {
  return (
    total <= 0 ||
    status === "pending" ||
    status === "quote_requested" ||
    status === "negotiating"
  );
}

function isClosed(status: string): boolean {
  return status === "cancelled" || status === "refunded";
}

/**
 * Статусы, на которых клиент может отменить заказ сам. Совпадает со списком
 * в серверном действии `cancelMyOrder` — здесь он нужен только чтобы показать
 * или спрятать кнопку: последнее слово всегда за сервером.
 */
const CUSTOMER_CANCELLABLE_STATUSES = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
];

export function isCustomerCancellable(status: string, paid: boolean): boolean {
  return !paid && CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

export function OrderCard({ order }: OrderCardProps) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const router = useRouter();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const currency = order.currency || "RUB";
  const agreedKopecks =
    order.total > 0
      ? order.total
      : order.finalPrice && order.finalPrice > 0
        ? Math.round(order.finalPrice * 100)
        : 0;
  const priced = agreedKopecks > 0;
  const unpriced = isUnpriced(order.status, agreedKopecks);
  const closed = isClosed(order.status);
  const invoices = order.invoices ?? [];
  // Статус заказа — рабочий процесс, а успешный Payment — доказательство
  // оплаты. Только второй включает клиентское подтверждение и блокирует счета.
  const paid = invoices.some((invoice) => invoice.status === "succeeded");
  const displayOrderNumber = order.orderNumber || order.number;

  const cancellable = isCustomerCancellable(order.status, paid);
  // Открытый, но уже оплаченный или взятый в работу заказ: отмена только через менеджера.
  const cancelBlocked = !closed && !cancellable;

  /**
   * Отмена заказа. Заказ и корзина — одна сущность, поэтому после отмены
   * обновляем страницу целиком: список заказов рендерит сервер.
   */
  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const result = await cancelMyOrder({ orderId: order.id });
      if (!result.ok) {
        toast({
          title: result.error || t("cancelFailed"),
          variant: "destructive",
        });
        return;
      }
      setConfirmingCancel(false);
      toast({ title: t("cancelledNotice", { number: displayOrderNumber }) });
      router.refresh();
    } catch {
      toast({ title: t("cancelFailed"), variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  const latestInvoice = invoices[0];
  const payable = !paid &&
    latestInvoice?.status === "pending" &&
    latestInvoice.amount === agreedKopecks
    ? latestInvoice
    : null;
  const paymentHref = payable?.paymentUrl ?? null;
  const createPayment = Boolean(payable && !payable.paymentUrl);
  const invoiceWaiting =
    !unpriced &&
    !paid &&
    !payable &&
    (order.status === "awaiting_payment" || order.status === "priced");

  const displayLines =
    order.items && order.items.length > 0
      ? order.items.map((item) => ({
          id: item.id,
          itemType: item.itemType || "service",
          title: item.title,
          quantity: item.quantity,
          amountKopecks: item.totalPrice
            ? item.totalPrice
            : item.estimatedUnitPrice * item.quantity,
        }))
      : (order.services ?? []).map((entry) => ({
          id: entry.id,
          itemType: "service",
          title: entry.service.title,
          quantity: entry.quantity,
          amountKopecks: (entry.service.basePrice ?? 0) * entry.quantity,
        }));

  const clientDescription = order.description || order.customerNote;

  return (
    <Card className="glass-panel border-border bg-background/65">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <CardTitle className="text-lg">{displayOrderNumber}</CardTitle>
          {order.isLocked ? (
            <Badge variant="outline" className="gap-1">
              <Lock aria-hidden="true" className="h-3 w-3" />
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button asChild variant="outline" size="sm">
            <Link href="/services" className="gap-1.5">
              <Plus aria-hidden="true" className="size-3.5" />
              {t("createOrder")}
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">{t("created")}</dt>
            <dd className="text-sm font-medium">
              {formatDate(order.createdAt, locale)}
            </dd>
          </div>

          <div>
            <dt className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar aria-hidden="true" className="size-3.5" />
              {t("deadline")}
            </dt>
            <dd className="text-sm font-medium">
              {order.deadline ? formatDate(order.deadline, locale) : "—"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t("estimate")}</dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatKopecks(order.estimatedAmount, currency, locale)}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t("agreed")}</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {priced ? formatKopecks(agreedKopecks, currency, locale) : "—"}
            </dd>
          </div>
        </dl>

        {displayLines.length > 0 ? (
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t("selectedItems")}
            </div>
            <ul className="space-y-2 text-sm">
              {displayLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 truncate text-foreground">
                    {line.itemType === "product" ? (
                      <Package
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                    ) : (
                      <Wrench
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                    )}
                    <span className="truncate">{line.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      ×{line.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatKopecks(line.amountKopecks, currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {clientDescription ? (
          <div className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm">
            <span className="font-medium text-foreground">
              {t("description")}:{" "}
            </span>
            <span className="whitespace-pre-wrap text-muted-foreground">
              {clientDescription}
            </span>
          </div>
        ) : null}

        {order.managerNote ? (
          <p className="rounded-lg border border-border bg-muted/60 px-3.5 py-2.5 text-sm">
            <span className="font-medium text-foreground">
              {t("managerComment")}:{" "}
            </span>
            <span className="text-muted-foreground">{order.managerNote}</span>
          </p>
        ) : null}

        {unpriced && !closed ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/15 px-4 py-3">
            <Clock
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-amber-200"
            />
            <p className="text-sm text-amber-200">{t("waitingForPrice")}</p>
          </div>
        ) : null}

        {order.status === "awaiting_payment" || order.status === "priced" ? (
          <>
            {payable && paymentHref ? (
              <Button
                asChild
                className="w-fit rounded-none border border-primary-foreground/20 bg-primary-foreground px-4 py-2 text-primary hover:bg-primary-foreground/85 hover:text-primary"
              >
                <a href={paymentHref}>
                  {t("pay")} {formatKopecks(payable.amount, currency, locale)}
                </a>
              </Button>
            ) : payable && createPayment ? (
              <form method="POST" action="/api/payment/create">
                <input type="hidden" name="orderId" value={order.id} />
                <Button
                  type="submit"
                  className="w-fit rounded-none border border-primary-foreground/20 bg-primary-foreground px-4 py-2 text-primary hover:bg-primary-foreground/85 hover:text-primary"
                >
                  {t("pay")} {formatKopecks(payable.amount, currency, locale)}
                </Button>
              </form>
            ) : null}
            {invoiceWaiting ? (
              <p className="text-sm text-muted-foreground">
                {t("invoicePending")}
              </p>
            ) : null}
          </>
        ) : null}

        {paid ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-emerald-200"
            />
            <p className="text-sm text-emerald-200">{t("paidThanks")}</p>
          </div>
        ) : null}

        {closed ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/35 bg-red-500/15 px-4 py-3">
            <XCircle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-red-200"
            />
            <p className="text-sm text-red-200">{t("declined")}</p>
          </div>
        ) : null}

        {cancellable ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            {confirmingCancel ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {t("cancelConfirm", { number: displayOrderNumber })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("cancelConfirmHint")}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("cancelHint")}</p>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {confirmingCancel ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isCancelling}
                    onClick={() => void handleCancel()}
                  >
                    {isCancelling ? t("cancelling") : t("cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isCancelling}
                    onClick={() => setConfirmingCancel(false)}
                  >
                    {t("cancelKeep")}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmingCancel(true)}
                >
                  <XCircle aria-hidden="true" className="size-3.5" />
                  {t("cancel")}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {cancelBlocked ? (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {t("cancelUnavailable")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
