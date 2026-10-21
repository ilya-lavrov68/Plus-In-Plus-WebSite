import { redirect } from "next/navigation";
import { BarChart3, Clock, CreditCard, Receipt, ShoppingCart, Users, Eye, Wallet } from "lucide-react";

import { CandlestickChart } from "@/components/spectrumui/candlestick-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDailySeries,
  getDeviceSplit,
  getTopPages,
  getTrafficSources,
  getTrafficSummary,
} from "@/lib/admin-analytics";
import { getFinanceSummary, getRevenueCandles, getSalesCandles } from "@/lib/admin-finance";
import { requireAdmin } from "@/lib/admin-session";
import { formatKopecks } from "@/lib/pricing";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

/** Сколько дней смотрим по умолчанию. */
const DAYS = 30;

function duration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
}

export default async function AdminAnalyticsPage() {
  const [admin, t] = await Promise.all([requireAdmin(), getRequestTranslations("admin")]);
  if (!admin) redirect("/");

  // Финансы видит только основатель: выручка и средний чек — коммерческая
  // информация, обычному админу для работы с сайтом она не нужна. Данные
  // даже не запрашиваем, а не просто прячем в интерфейсе.
  const isFounder = admin.isFounder;

  const [summary, pages, sources, devices, series, finance, revenueCandles, salesCandles] =
    await Promise.all([
      getTrafficSummary(DAYS),
      getTopPages(DAYS),
      getTrafficSources(DAYS),
      getDeviceSplit(DAYS),
      getDailySeries(DAYS),
      isFounder ? getFinanceSummary(DAYS) : Promise.resolve(null),
      isFounder ? getRevenueCandles(DAYS) : Promise.resolve([]),
      isFounder ? getSalesCandles(DAYS) : Promise.resolve([]),
    ]);

  const maxDayViews = Math.max(1, ...series.map((day) => day.views));
  const maxPageViews = Math.max(1, ...pages.map((page) => page.views));
  const totalDevices = Math.max(1, devices.reduce((sum, item) => sum + item.views, 0));

  const cards = [
    { title: t("analyticsViews"), icon: Eye, value: String(summary.views) },
    { title: t("analyticsVisitors"), icon: Users, value: String(summary.visitors) },
    { title: t("analyticsSessions"), icon: BarChart3, value: String(summary.sessions) },
    { title: t("analyticsAvgTime"), icon: Clock, value: duration(summary.avgSeconds) },
  ];

  const financeCards = finance
    ? [
        { title: t("financeRevenue"), icon: Wallet, value: formatKopecks(finance.revenue) },
        { title: t("financePayments"), icon: CreditCard, value: String(finance.paymentsCount) },
        { title: t("financeOrders"), icon: ShoppingCart, value: String(finance.ordersCount) },
        { title: t("financeAvgCheck"), icon: Receipt, value: formatKopecks(finance.averageCheck) },
      ]
    : [];

  // Подписи для свечей передаются строками: компонент графика клиентский,
  // а переводы живут на сервере.
  const candleLabels = {
    open: t("candleOpen"),
    high: t("candleHigh"),
    low: t("candleLow"),
    close: t("candleClose"),
    empty: t("analyticsEmpty"),
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("analytics")}</h1>
      <p className="mt-2 text-muted-foreground">{t("analyticsSubtitle", { days: DAYS })}</p>

      {/* ── Финансы: доход и продажи как свечные графики (только FOUNDER) ─── */}
      {isFounder && finance ? (
        <>
      <h2 className="mt-10 text-xl font-semibold tracking-tight">{t("financeTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("financeSubtitle", { days: DAYS })}</p>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {financeCards.map(({ title, icon: Icon, value }) => (
          <Card key={title}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("financeRevenueChart")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("financeRevenueChartHint")}</p>
          </CardHeader>
          <CardContent>
            <CandlestickChart
              data={revenueCandles}
              valueKind="money"
              labels={{ ...candleLabels, volume: t("candleDayTotal") }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("financeSalesChart")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("financeSalesChartHint")}</p>
          </CardHeader>
          <CardContent>
            <CandlestickChart
              data={salesCandles}
              valueKind="money"
              volumeKind="number"
              labels={{ ...candleLabels, volume: t("candleDayCount") }}
            />
          </CardContent>
        </Card>
      </div>
        </>
      ) : null}

      {/* ── Трафик ─────────────────────────────────────────────────────────── */}
      <h2 className="mt-10 text-xl font-semibold tracking-tight">{t("trafficTitle")}</h2>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ title, icon: Icon, value }) => (
          <Card key={title}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analyticsTopPages")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pages.length ? (
              <ul className="space-y-3">
                {pages.map((page) => (
                  <li key={page.path}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{page.path}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {page.views} · {t("analyticsUnique")} {page.visitors} · {duration(page.avgSeconds)}
                      </span>
                    </div>
                    {/* Полоса — чтобы сравнение страниц читалось глазами,
                        а не только цифрами. */}
                    <div
                      className="mt-1 h-1.5 rounded-full bg-muted"
                      role="img"
                      aria-label={t("analyticsShare", { count: page.views })}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((page.views / maxPageViews) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("analyticsEmpty")}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("analyticsDevices")}</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length ? (
                <ul className="space-y-2 text-sm">
                  {devices.map((item) => (
                    <li key={item.device} className="flex items-baseline justify-between gap-3">
                      <span>{t(`device_${item.device}`)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {Math.round((item.views / totalDevices) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("analyticsEmpty")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("analyticsSources")}</CardTitle>
            </CardHeader>
            <CardContent>
              {sources.length ? (
                <ul className="space-y-2 text-sm">
                  {sources.map((source) => (
                    <li key={source.name} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{source.name.replace(/^utm:/, "utm: ")}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{source.views}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("analyticsEmpty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("analyticsByDay")}</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length ? (
            <div className="flex h-40 items-end gap-1" role="img" aria-label={t("analyticsByDay")}>
              {series.map((day) => (
                <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  {/* Высота столбца — доля от самого удачного дня. */}
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${Math.max(4, Math.round((day.views / maxDayViews) * 100))}%` }}
                    title={`${day.date}: ${day.views}`}
                  />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                    {day.date.slice(8)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("analyticsEmpty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
