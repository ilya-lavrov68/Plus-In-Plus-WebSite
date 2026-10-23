"use client";

import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function isPaid(status: string): boolean {
  return status === "paid" || status === "in_progress" || status === "completed";
}

export function OrderCard({ order }: OrderCardProps) {
  const t = useTranslations("orders");
  const locale = useLocale();

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
  const paid = isPaid(order.status);

  const payable = (order.invoices ?? []).find(
    (invoice) => invoice.status === "pending" && invoice.paymentUrl
  );
  const invoiceWaiting =
    !unpriced &&
    !payable &&
    (order.status === "awaiting_payment" || order.status === "priced");

  const displayLines =
    order.items && order.items.length > 0
      ? order.items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          amountKopecks: item.totalPrice
            ? item.totalPrice
            : item.estimatedUnitPrice * item.quantity,
        }))
      : (order.services ?? []).map((entry) => ({
          id: entry.id,
          title: entry.service.title,
          quantity: entry.quantity,
          amountKopecks: (entry.service.basePrice ?? 0) * entry.quantity,
        }));

  const clientDescription = order.description || order.customerNote;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <CardTitle className="text-lg">{order.number}</CardTitle>
          {order.isLocked ? (
            <Badge variant="outline" className="gap-1">
              <Lock aria-hidden="true" className="h-3 w-3" />
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button asChild variant="outline" size="sm">
            <Link href="/contact" className="gap-1.5">
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
              {formatKopecks(order.estimatedAmount, currency)}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t("agreed")}</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {priced ? formatKopecks(agreedKopecks, currency) : "—"}
            </dd>
          </div>
        </dl>

        {displayLines.length > 0 ? (
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t("selectedServices")}
            </div>
            <ul className="space-y-1.5 text-sm">
              {displayLines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-foreground">
                    {line.title}
                    {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatKopecks(line.amountKopecks, currency)}
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
            {payable ? (
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
      </CardContent>
    </Card>
  );
}
