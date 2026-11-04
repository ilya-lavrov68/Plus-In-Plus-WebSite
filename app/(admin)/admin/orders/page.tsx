import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { AdminChip, AdminPageHeader, adminButton, adminSelectClass } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrders, getOrderStatusCounts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { ORDER_STATUSES } from "@/lib/order-status";
import { getRequestLocale } from "@/lib/request-locale";

import { updateOrderStatus } from "./actions";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const { status } = await searchParams;
  const filter = typeof status === "string" && (ORDER_STATUSES as readonly string[]).includes(status) ? status : undefined;

  const [orders, counts] = await Promise.all([getOrders({ limit: 50, status: filter }), getOrderStatusCounts()]);
  const totalByStatus = new Map(counts.map((item) => [item.status, item.count]));
  const money = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });
  const dateTime = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const canEdit = Boolean(staff?.isAdmin);
  const activeChipClass =
    "inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3.5 py-1.5 text-xs font-medium text-on-secondary-container transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const inactiveChipClass =
    "inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3.5 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t.orders.title} description={t.orders.subtitle} />

      <nav aria-label={t.orders.filter} className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          aria-current={filter ? undefined : "page"}
          className={filter ? inactiveChipClass : activeChipClass}
        >
          {t.orders.all}
        </Link>
        {ORDER_STATUSES.map((value) => {
          const active = filter === value;
          const count = totalByStatus.get(value) ?? 0;
          return (
            <Link
              key={value}
              href={`/admin/orders?status=${value}`}
              aria-current={active ? "page" : undefined}
              className={active ? activeChipClass : inactiveChipClass}
            >
              {t.statuses[value] ?? value} · {count}
            </Link>
          );
        })}
      </nav>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.order}</TableHead>
            <TableHead>{t.table.customer}</TableHead>
            <TableHead>{t.table.date}</TableHead>
            <TableHead className="text-right">{t.table.total}</TableHead>
            <TableHead>{t.table.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-on-surface-variant">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                <TableCell className="max-w-[220px]">
                  <span className="block truncate">{order.customer || "—"}</span>
                  <span className="block truncate text-xs text-on-surface-variant">{order.email}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-on-surface-variant">
                  {order.createdAt ? dateTime.format(new Date(order.createdAt)) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money.format(order.total)}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <form action={updateOrderStatus} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <label className="sr-only" htmlFor={`status-${order.id}`}>
                        {t.orders.statusOf}
                      </label>
                      <select
                        id={`status-${order.id}`}
                        name="status"
                        defaultValue={order.status}
                        className={`${adminSelectClass} h-9 w-auto min-w-40 py-0 text-xs`}
                      >
                        {ORDER_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {t.statuses[value] ?? value}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className={adminButton("outlined", "sm")}
                      >
                        {t.table.save}
                      </button>
                    </form>
                  ) : (
                    <AdminChip>{t.statuses[order.status] ?? order.status}</AdminChip>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
