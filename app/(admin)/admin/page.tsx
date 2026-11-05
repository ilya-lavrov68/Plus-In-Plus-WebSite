import Link from "next/link";

import { BarList, ColumnChart } from "@/components/admin/charts";
import { ChartAreaInteractive } from "@/components/admin/dashboard/chart-area-interactive";
import { DataTable, type DataTableRow } from "@/components/admin/dashboard/data-table";
import { SectionCards, type SectionCardMetric } from "@/components/admin/dashboard/section-cards";
import { adminLabels } from "@/components/admin/labels";
import { AdminPageHeader } from "@/components/admin/ui";
import { SectionCard } from "@/components/admin/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getDailySeries,
  getDeviceSplit,
  getOrderStats,
  getTopPages,
  getTrafficSources,
  getTrafficSummary,
} from "@/lib/admin-analytics";
import { getActivity, getContentCounts, getOrderStatusCounts, getOrders, getRevenueSeries } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

/** Тренд метрики: направление дублируется словом и иконкой, а не только цветом. */
type Trend = { direction: "up" | "down" | "flat"; delta: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ключ дня для периодов: последние 7 дней против предыдущих 7. */
const dayKey = (offset: number) => new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
const inRange = (date: string, fromOffset: number, toOffset: number) => date >= dayKey(fromOffset) && date <= dayKey(toOffset);

export default async function AdminOverviewPage() {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const isAdmin = Boolean(staff?.isAdmin);

  const [orderStats, traffic, daily, topPages, sources, devices, recentOrders, counts, revenue, activity, statusCounts] =
    await Promise.all([
      getOrderStats(),
      isAdmin ? getTrafficSummary(30) : null,
      isAdmin ? getDailySeries(30) : null,
      isAdmin ? getTopPages(30, 6) : null,
      isAdmin ? getTrafficSources(30) : null,
      isAdmin ? getDeviceSplit(30) : null,
      // Дашборд показывает свежую выручку/заказы: 25 строк достаточно, а
      // 200 строк раздували RSC-ответ и HTML страницы обзора.
      getOrders({ limit: 25 }),
      isAdmin ? getContentCounts() : null,
      getRevenueSeries(30),
      isAdmin ? getActivity(6) : null,
      getOrderStatusCounts(),
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

  const trend = (current: number, previous: number): Trend => {
    if (previous > 0) {
      const change = ((current - previous) / previous) * 100;
      if (Math.abs(change) < 0.5) return { direction: "flat", delta: "0%" };
      return {
        direction: change > 0 ? "up" : "down",
        delta: `${change > 0 ? "+" : "−"}${Math.abs(Math.round(change))}%`,
      };
    }
    return current === 0 ? { direction: "flat", delta: "0%" } : { direction: "up", delta: t.dashboard.trend.fresh };
  };

  const sumRevenue = (from: number, to: number) =>
    revenue.filter((point) => inRange(point.date, from, to)).reduce((sum, point) => sum + point.revenue, 0);
  const sumOrders = (from: number, to: number) =>
    revenue.filter((point) => inRange(point.date, from, to)).reduce((sum, point) => sum + point.orders, 0);

  const revenue30 = sumRevenue(0, 30);
  const orders30 = sumOrders(0, 30);
  const revenueWeek = sumRevenue(0, 7);
  const revenuePrevWeek = sumRevenue(7, 14);
  const ordersWeek = sumOrders(0, 7);
  const ordersPrevWeek = sumOrders(7, 14);
  const averageCheck = orders30 > 0 ? Math.round(revenue30 / orders30) : 0;
  const averageWeek = ordersWeek > 0 ? revenueWeek / ordersWeek : 0;
  const averagePrevWeek = ordersPrevWeek > 0 ? revenuePrevWeek / ordersPrevWeek : 0;

  const trendHint = `${t.dashboard.trend.week} ${t.dashboard.trend.vsPrev}`;

  const cards: SectionCardMetric[] = [
    {
      label: t.overview.revenue,
      value: money.format(revenue30 || orderStats.revenue),
      ...trend(revenueWeek, revenuePrevWeek),
      hint: trendHint,
      footer: `${t.dashboard.trend.period} · ${t.overview.revenueHint}`,
    },
    {
      label: t.overview.paidOrders,
      value: number.format(orders30 || orderStats.paidCount),
      ...trend(ordersWeek, ordersPrevWeek),
      hint: trendHint,
      footer: `${t.dashboard.trend.period} · ${t.overview.queueHint}`,
    },
    {
      label: t.overview.average,
      value: money.format(averageCheck || orderStats.averageOrder),
      ...trend(averageWeek, averagePrevWeek),
      hint: trendHint,
      footer: t.dashboard.trend.period,
    },
    {
      label: t.overview.queue,
      value: number.format(orderStats.queue),
      direction: "flat",
      delta: t.dashboard.trend.period,
      hint: t.overview.queueHint,
      footer: t.overview.statusHint,
    },
  ];

  if (isAdmin && traffic) {
    const viewsWeek = daily?.filter((point) => inRange(point.date, 0, 7)).reduce((sum, point) => sum + point.views, 0) ?? 0;
    const viewsPrevWeek = daily?.filter((point) => inRange(point.date, 7, 14)).reduce((sum, point) => sum + point.views, 0) ?? 0;
    const visitorsWeek = daily?.filter((point) => inRange(point.date, 0, 7)).reduce((sum, point) => sum + point.visitors, 0) ?? 0;
    const visitorsPrevWeek = daily?.filter((point) => inRange(point.date, 7, 14)).reduce((sum, point) => sum + point.visitors, 0) ?? 0;

    cards.push(
      {
        label: t.overview.views,
        value: number.format(traffic.views),
        ...trend(viewsWeek, viewsPrevWeek),
        hint: trendHint,
        footer: t.dashboard.trend.period,
      },
      {
        label: t.overview.visitors,
        value: number.format(traffic.visitors),
        ...trend(visitorsWeek, visitorsPrevWeek),
        hint: trendHint,
        footer: t.dashboard.trend.period,
      },
      {
        label: t.overview.avgTime,
        value: duration(traffic.avgSeconds),
        direction: "flat",
        delta: `${number.format(traffic.sessions)}`,
        hint: t.dashboard.trend.period,
        footer: t.overview.trafficHint,
      },
      {
        label: t.overview.contentTitle,
        value: counts ? `${number.format(counts.services)} / ${number.format(counts.posts)}` : "—",
        direction: "flat",
        delta: `${number.format(counts?.products ?? 0)}`,
        hint: `${t.nav.services} / ${t.nav.posts}`,
        footer: `${t.nav.products}: ${number.format(counts?.products ?? 0)}`,
      },
    );
  }

  const tableRows: DataTableRow[] = recentOrders.map((order) => ({
    id: order.id,
    order: order.orderNumber,
    customer: order.customer || "—",
    email: order.email || "",
    status: order.status,
    statusLabel: statusLabel(order.status),
    total: money.format(order.total),
    date: order.createdAt.slice(0, 10),
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t.overview.title} description={t.overview.subtitle} />

      <SectionCards cards={cards} />

      {isAdmin && daily ? (
        <ChartAreaInteractive
          data={daily.map((point) => ({
            date: point.date,
            label: dayLabel(point.date),
            views: point.views,
            visitors: point.visitors,
          }))}
          labels={{
            title: t.dashboard.chart.title,
            description: t.dashboard.chart.description,
            range: t.dashboard.chart.range,
            primary: t.dashboard.chart.views,
            secondary: t.dashboard.chart.visitors,
            total: t.dashboard.chart.period,
            empty: t.dashboard.chart.empty,
            ranges: [
              { days: 30, label: t.dashboard.chart.range30 },
              { days: 14, label: t.dashboard.chart.range14 },
              { days: 7, label: t.dashboard.chart.range7 },
            ],
          }}
        />
      ) : null}

      <DataTable
        rows={tableRows}
        moneyColumnHint={t.dashboard.table.moneyHint}
        labels={{
          title: t.dashboard.table.title,
          description: t.dashboard.table.description,
          tabs: {
            all: t.dashboard.table.tabsAll,
            queued: t.dashboard.table.tabsQueued,
            done: t.dashboard.table.tabsDone,
          },
          search: t.dashboard.table.search,
          columns: t.dashboard.table.columns,
          selected: t.dashboard.table.selected,
          empty: t.dashboard.table.empty,
          drag: t.dashboard.table.drag,
          prev: t.dashboard.table.prev,
          next: t.dashboard.table.next,
          page: t.dashboard.table.page,
          of: t.dashboard.table.of,
          rows: t.dashboard.table.rows,
          reset: t.dashboard.table.reset,
          open: t.dashboard.table.open,
          statusFilter: t.dashboard.table.statusFilter,
          columnLabels: t.dashboard.table.columnLabels,
        }}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t.overview.revenueTitle} description={t.overview.trafficHint}>
          {revenue.some((point) => point.revenue > 0) ? (
            <>
              <ColumnChart
                data={revenue.map((point) => ({ label: dayLabel(point.date), value: point.revenue }))}
                ariaLabel={t.overview.revenueTitle}
                formatValue={(value) => money.format(value)}
              />
              <p className="mt-3 text-xs text-on-surface-variant">
                {money.format(revenue.reduce((sum, point) => sum + point.revenue, 0))} · {t.dashboard.trend.period}
              </p>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">{t.overview.revenueEmpty}</p>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title={t.overview.statusTitle} description={t.overview.statusHint}>
            <BarList
              items={statusCounts
                .filter((item) => item.count > 0)
                .map((item) => ({ label: statusLabel(item.status), value: item.count }))}
              emptyLabel={t.overview.empty}
              formatValue={(value) => number.format(value)}
            />
          </SectionCard>
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
          <SectionCard
            className="xl:col-span-2"
            title={t.overview.topPagesTitle}
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
                  <li key={entry.id} className="pb-3 last:pb-0">
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
