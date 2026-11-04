import Link from "next/link";

import { AreaChart, BarList, ColumnChart } from "@/components/admin/charts";
import { adminLabels } from "@/components/admin/labels";
import { AdminChip, AdminPageHeader } from "@/components/admin/ui";
import { SectionCard, StatCard } from "@/components/admin/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getDailySeries,
  getDeviceSplit,
  getOrderStats,
  getTopPages,
  getTrafficSources,
  getTrafficSummary,
} from "@/lib/admin-analytics";
import { getActivity, getContentCounts, getOrders, getRevenueSeries } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminOverviewPage() {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const isAdmin = Boolean(staff?.isAdmin);

  const [orderStats, traffic, daily, topPages, sources, devices, recentOrders, counts, revenue, activity] =
    await Promise.all([
      getOrderStats(),
      isAdmin ? getTrafficSummary(30) : null,
      isAdmin ? getDailySeries(30) : null,
      isAdmin ? getTopPages(30, 6) : null,
      isAdmin ? getTrafficSources(30) : null,
      isAdmin ? getDeviceSplit(30) : null,
      getOrders({ limit: 6 }),
      isAdmin ? getContentCounts() : null,
      isAdmin ? getRevenueSeries(14) : null,
      isAdmin ? getActivity(6) : null,
    ]);

  const money = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB");
  const dayLabel = (iso: string) => {
    const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? iso.slice(5)
      : date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  };
  const duration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const statusLabel = (status: string) => t.statuses[status] ?? status;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader eyebrow="Plus In Plus" title={t.overview.title} description={t.overview.subtitle} />

      <section aria-label={t.overview.title} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.overview.queue} value={number.format(orderStats.queue)} hint={t.overview.queueHint} accent />
        <StatCard label={t.overview.revenue} value={money.format(orderStats.revenue)} hint={t.overview.revenueHint} />
        <StatCard label={t.overview.paidOrders} value={number.format(orderStats.paidCount)} />
        <StatCard label={t.overview.average} value={money.format(orderStats.averageOrder)} />
        {isAdmin && traffic ? (
          <>
            <StatCard label={t.overview.views} value={number.format(traffic.views)} hint="30d" />
            <StatCard label={t.overview.visitors} value={number.format(traffic.visitors)} hint="30d" />
            <StatCard label={t.overview.avgTime} value={duration(traffic.avgSeconds)} hint={`${number.format(traffic.sessions)} sessions`} />
            {counts ? (
              <StatCard
                label={t.overview.contentTitle}
                value={`${number.format(counts.services)} / ${number.format(counts.posts)}`}
                hint={`${t.nav.services} / ${t.nav.posts}`}
              />
            ) : null}
          </>
        ) : null}
      </section>

      {isAdmin && daily ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard
            className="xl:col-span-2"
            title={t.overview.trafficTitle}
            description={t.overview.trafficHint}
          >
            <AreaChart
              data={daily.map((point) => ({
                label: dayLabel(point.date),
                primary: point.views,
                secondary: point.visitors,
              }))}
              ariaLabel={t.overview.trafficTitle}
              primaryLabel={t.overview.views}
              secondaryLabel={t.overview.visitors}
            />
          </SectionCard>
          <SectionCard title={t.overview.revenueTitle}>
            {revenue && revenue.some((point) => point.revenue > 0) ? (
              <>
                <ColumnChart
                  data={revenue.map((point) => ({ label: dayLabel(point.date), value: point.revenue }))}
                  ariaLabel={t.overview.revenueTitle}
                  formatValue={(value) => money.format(value)}
                />
                <p className="mt-3 text-xs text-on-surface-variant">
                  {number.format(revenue.reduce((sum, point) => sum + point.revenue, 0))} ₽ · 14d
                </p>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">{t.overview.revenueEmpty}</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title={t.overview.recentOrdersTitle}
          action={
            <Link
              href="/admin/orders"
              className="whitespace-nowrap text-xs text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
            >
              {t.overview.allOrders}
            </Link>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.table.order}</TableHead>
                <TableHead>{t.table.customer}</TableHead>
                <TableHead>{t.table.status}</TableHead>
                <TableHead className="text-right">{t.table.total}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-on-surface-variant">
                    {t.table.empty}
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{order.customer || order.email || "—"}</TableCell>
                    <TableCell>
                      <AdminChip>{statusLabel(order.status)}</AdminChip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(order.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <div className="flex flex-col gap-4">
          {isAdmin && sources ? (
            <SectionCard title={t.overview.sourcesTitle}>
              <BarList
                items={sources.slice(0, 5).map((item) => ({ label: item.name || "direct", value: item.views }))}
                emptyLabel={t.overview.empty}
                formatValue={(value) => number.format(value)}
              />
            </SectionCard>
          ) : null}
          {isAdmin && devices ? (
            <SectionCard title={t.overview.devicesTitle}>
              <BarList
                items={devices.map((item) => ({ label: item.device || "unknown", value: item.views }))}
                emptyLabel={t.overview.empty}
                formatValue={(value) => number.format(value)}
              />
            </SectionCard>
          ) : null}
        </div>
      </div>

      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard className="xl:col-span-2" title={t.overview.topPagesTitle}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.table.title}</TableHead>
                  <TableHead className="text-right">{t.overview.views}</TableHead>
                  <TableHead className="text-right">{t.overview.visitors}</TableHead>
                  <TableHead className="text-right">{t.overview.avgTime}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!topPages || topPages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-on-surface-variant">
                      {t.overview.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  topPages.map((page) => (
                    <TableRow key={page.path}>
                      <TableCell className="max-w-[320px] truncate">{page.path}</TableCell>
                      <TableCell className="text-right tabular-nums">{number.format(page.views)}</TableCell>
                      <TableCell className="text-right tabular-nums">{number.format(page.visitors)}</TableCell>
                      <TableCell className="text-right tabular-nums">{duration(page.avgSeconds)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title={t.overview.activityTitle}>
            {!activity || activity.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t.overview.empty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
                    <p className="text-sm">{entry.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {entry.action} · {entry.entityType} · {entry.createdAt.slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
