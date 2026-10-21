"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { DataTableColumn } from "@/components/admin/admin-data-table";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { OrdersBasePath } from "@/components/orders/orders-view";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AdminOrderRow {
  id: string;
  number: string;
  status: string;
  estimatedAmount: number;
  total: number;
  currency: string;
  customerEmail: string;
  /** Заблокирован от редактирования (править может только FOUNDER). */
  isLocked: boolean;
  createdAt: Date;
}

/** Копейки → «15 600 ₽». Нуль означает «цена ещё не согласована», не «бесплатно». */
function money(kopecks: number, currency: string): string {
  if (!kopecks) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

function dateTime(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export function OrdersTable({
  orders,
  statuses,
  basePath,
}: {
  orders: AdminOrderRow[];
  statuses: readonly string[];
  /** Куда ведут ссылки на заявку: /admin/orders или /manager/orders. */
  basePath: OrdersBasePath;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [pageSize, setPageSize] = useState(10);

  const columns = useMemo<DataTableColumn<AdminOrderRow>[]>(
    () => [
      {
        id: "number",
        header: t("orderNumber"),
        sortable: true,
        cell: (row) => (
          <span className="inline-flex items-center gap-1.5">
            <Link
              href={`${basePath}/${encodeURIComponent(row.id)}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.number}
            </Link>
            {row.isLocked ? (
              <Lock aria-label={t("orderLockedBadge")} className="h-3.5 w-3.5 text-muted-foreground" />
            ) : null}
          </span>
        ),
      },
      {
        id: "customer",
        header: t("customer"),
        sortable: true,
        cell: (row) => <span className="break-all">{row.customerEmail}</span>,
      },
      {
        id: "estimatedAmount",
        header: t("estimated"),
        sortable: true,
        numeric: true,
        cell: (row) => (
          <span className="text-muted-foreground">
            {money(row.estimatedAmount, row.currency)}
          </span>
        ),
      },
      {
        id: "total",
        header: t("agreed"),
        sortable: true,
        numeric: true,
        // Согласованная цена — главное число в строке: именно её ждёт клиент.
        cell: (row) => (
          <span className={row.total ? "font-semibold" : "text-muted-foreground"}>
            {money(row.total, row.currency)}
          </span>
        ),
      },
      {
        id: "status",
        header: t("status"),
        sortable: true,
        cell: (row) => <OrderStatusBadge status={row.status} />,
      },
      {
        id: "createdAt",
        header: t("created"),
        // Даты сортируются как числа — по строке «12 окт.» порядок был бы неверным.
        value: (row) => row.createdAt.getTime(),
        sortable: true,
        cell: (row) => <span className="text-muted-foreground">{dateTime(row.createdAt)}</span>,
      },
    ],
    [t, basePath],
  );

  return (
    <AdminDataTable
      data={orders}
      columns={columns}
      rowId={(order) => order.id}
      rowLabel={(order) => order.number}
      variant="bordered"
      searchable
      searchPlaceholder={t("searchOrders")}
      searchText={(order) => `${order.number} ${order.customerEmail}`}
      // Статус — главное измерение, по которому менеджер смотрит очередь.
      quickFilter={{
        columnId: "status",
        label: tc("status"),
        allLabel: t("allStatuses"),
        options: statuses.map((status) => ({ value: status, label: t(`status_${status}`) })),
      }}
      defaultSort={{ columnId: "createdAt", direction: "desc" }}
      pageSize={pageSize}
      emptyState={<p className="py-8 text-center text-sm text-muted-foreground">{t("noOrders")}</p>}
      toolbar={
        <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
          <SelectTrigger className="h-9 w-[7.5rem]" aria-label={t("rows")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t("rowsPerPage", { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      rowActions={(row) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`${basePath}/${encodeURIComponent(row.id)}`}>{t("openOrder")}</Link>
        </Button>
      )}
    />
  );
}
