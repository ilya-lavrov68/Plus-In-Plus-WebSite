"use client";

import * as React from "react";

import { AreaChart } from "@/components/admin/charts";
import { cn } from "@/lib/utils";

export interface InteractiveChartPoint {
  /** ISO-дата точки: используется как ключ и для подписи в подсказке. */
  date: string;
  label: string;
  views: number;
  visitors: number;
}

export interface InteractiveChartLabels {
  title: string;
  description: string;
  range: string;
  primary: string;
  secondary: string;
  total: string;
  empty: string;
  ranges: { days: number; label: string }[];
}

/**
 * Интерактивный area-chart в духе `dashboard-01`: диапазон переключается
 * кнопками-таблетками, данные фильтруются на клиенте — запрос к базе остаётся
 * один, сервер отдаёт сразу 30 дней. Рисунок — тот же чистый SVG, что и в
 * остальной панели (без сторонних библиотек, без теней).
 */
export function ChartAreaInteractive({ data, labels }: { data: InteractiveChartPoint[]; labels: InteractiveChartLabels }) {
  const [days, setDays] = React.useState(labels.ranges[0]?.days ?? 30);

  const visible = React.useMemo(() => data.slice(-days), [data, days]);
  const viewsTotal = visible.reduce((sum, point) => sum + point.views, 0);
  const visitorsTotal = visible.reduce((sum, point) => sum + point.visitors, 0);
  const number = React.useMemo(() => new Intl.NumberFormat("ru-RU"), []);

  return (
    <section aria-label={labels.title} className="flex flex-col gap-4 rounded-2xl bg-surface-container-low p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-on-surface">{labels.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{labels.description}</p>
        </div>
        <div
          role="group"
          aria-label={labels.range}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-container p-1"
        >
          {labels.ranges.map((range) => (
            <button
              key={range.days}
              type="button"
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                days === range.days
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{labels.empty}</p>
      ) : (
        <>
          <AreaChart
            data={visible.map((point) => ({ label: point.label, primary: point.views, secondary: point.visitors }))}
            ariaLabel={labels.title}
            primaryLabel={labels.primary}
            secondaryLabel={labels.secondary}
          />
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-on-surface-variant">
            <div className="flex items-baseline gap-2">
              <dt>{labels.primary}</dt>
              <dd className="text-sm font-medium text-on-surface tabular-nums">{number.format(viewsTotal)}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt>{labels.secondary}</dt>
              <dd className="text-sm font-medium text-on-surface tabular-nums">{number.format(visitorsTotal)}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt>{labels.total}</dt>
              <dd className="text-sm font-medium text-on-surface tabular-nums">{labels.ranges.find((range) => range.days === days)?.label}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
