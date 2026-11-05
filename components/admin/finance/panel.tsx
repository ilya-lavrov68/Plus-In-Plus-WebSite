"use client";

import * as React from "react";

import { loadFinanceChart } from "@/app/(admin)/admin/finance/chart-data";
import { AdminStatus } from "@/components/admin/ui";
import type { FinanceKind, FinancePayload } from "@/lib/admin-finance";
import type { RequestLocale } from "@/lib/request-locale";

import { CandleChart, type CandleLabels } from "./candles";
import { CategoryStack, type CategoryLabels } from "./categories";
import { ChartFrame, RangeTabs } from "./chart-frame";
import { HistogramChart, type HistogramLabels } from "./histogram";
import { PortfolioChart, type PortfolioLabels } from "./portfolio";

export interface FinancePanelLabels {
  range: string;
  ranges: { value: string; label: string }[];
  loading: string;
  error: string;
  candles: CandleLabels & { title: string; description: string; empty: string };
  portfolio: PortfolioLabels & { title: string; description: string; empty: string };
  checks: HistogramLabels & { title: string; description: string; empty: string };
  categories: CategoryLabels & { title: string; description: string; empty: string };
  summaryTitle: string;
  summaryHint: string;
  summary: {
    backlog: string;
    backlogHint: string;
    revenue: string;
    revenueHint: string;
    average: string;
    averageHint: string;
    today: string;
    todayHint: string;
    paidShare: string;
  };
}

const CHART_TITLES: Record<FinanceKind, (labels: FinancePanelLabels) => { title: string; description: string; empty: string }> = {
  candles: (labels) => labels.candles,
  portfolio: (labels) => labels.portfolio,
  checks: (labels) => labels.checks,
  categories: (labels) => labels.categories,
};

/**
 * Панель финансового графика: сервер отдаёт первую порцию данных, клиент
 * переключает диапазон и запрашивает следующую через серверное действие.
 *
 * Первая порция приходит из server component и стримится в разметку — график
 * появляется вместе со страницей. Переключение периода не перезагружает
 * страницу: пока данные едут, на панели стоит `aria-busy`, а старое содержимое
 * остаётся на месте, чтобы не мигало пустотой.
 */
export function FinancePanel({
  kind,
  initialRange,
  initial,
  labels,
  locale,
  currency = "RUB",
  className,
}: {
  kind: FinanceKind;
  initialRange: string;
  initial: FinancePayload;
  labels: FinancePanelLabels;
  locale: RequestLocale;
  currency?: string;
  className?: string;
}) {
  const [range, setRange] = React.useState(initialRange);
  const [payload, setPayload] = React.useState<FinancePayload>(initial);
  const [pending, startTransition] = React.useTransition();
  const [failed, setFailed] = React.useState(false);
  const heading = CHART_TITLES[kind](labels);

  const changeRange = (next: string) => {
    if (next === range) return;
    setRange(next);
    setFailed(false);
    startTransition(async () => {
      try {
        const data = await loadFinanceChart(kind, next);
        setPayload(data);
      } catch {
        setFailed(true);
      }
    });
  };

  const empty =
    payload.kind === "candles"
      ? payload.candles.length === 0
      : payload.kind === "portfolio"
        ? payload.portfolio.points.every((point) => point.value === 0)
        : payload.kind === "checks"
          ? payload.histogram.samples === 0
          : payload.categories.dates.length === 0;

  return (
    <ChartFrame
      className={className}
      title={heading.title}
      description={heading.description}
      empty={heading.empty}
      isEmpty={empty}
      toolbar={
        <RangeTabs
          label={labels.range}
          options={labels.ranges}
          value={range}
          onChange={changeRange}
          pending={pending}
        />
      }
      legend={
        <div className="flex flex-col gap-2">
          {failed ? <AdminStatus tone="error">{labels.error}</AdminStatus> : null}
          {pending ? (
            <p role="status" className="text-xs text-on-surface-variant">
              {labels.loading}
            </p>
          ) : null}
        </div>
      }
    >
      <div className={pending ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
        {payload.kind === "candles" ? (
          <CandleChart candles={payload.candles} labels={labels.candles} locale={locale} currency={currency} />
        ) : null}
        {payload.kind === "portfolio" ? (
          <PortfolioChart series={payload.portfolio} labels={labels.portfolio} locale={locale} currency={currency} />
        ) : null}
        {payload.kind === "checks" ? (
          <HistogramChart histogram={payload.histogram} labels={labels.checks} locale={locale} currency={currency} />
        ) : null}
        {payload.kind === "categories" ? (
          <CategoryStack series={payload.categories} labels={labels.categories} locale={locale} currency={currency} />
        ) : null}
      </div>
    </ChartFrame>
  );
}
