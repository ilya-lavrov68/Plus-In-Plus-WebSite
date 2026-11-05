"use client";

import * as React from "react";

import type { CheckHistogram } from "@/lib/finance-math";
import type { RequestLocale } from "@/lib/request-locale";

import { ChartDataTable, ChartLegend } from "./chart-frame";
import { moneyFormatter, numberFormatter } from "./format";

export interface HistogramLabels {
  samples: string;
  mean: string;
  p50: string;
  p95: string;
  max: string;
  share: string;
  range: string;
  count: string;
  table: string;
}

const WIDTH = 900;
const HEIGHT = 260;
const PAD = { top: 22, right: 16, bottom: 44, left: 44 };

/**
 * Гистограмма сумм заказов: корзины на «красивых» границах плюс отметки
 * медианы и 95-го процентиля.
 *
 * Смысл — увидеть форму распределения: один крупный заказ иначе теряется за
 * средним чеком. Отметки подписаны словами, а не только линией.
 */
export function HistogramChart({
  histogram,
  labels,
  locale,
  currency = "RUB",
}: {
  histogram: CheckHistogram;
  labels: HistogramLabels;
  locale: RequestLocale;
  currency?: string;
}) {
  const money = React.useMemo(() => moneyFormatter(locale, { currency }), [locale, currency]);
  const number = React.useMemo(() => numberFormatter(locale), [locale]);
  const bins = histogram.bins;

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const slot = bins.length > 0 ? innerWidth / bins.length : innerWidth;
  const barWidth = Math.max(4, slot * 0.72);

  const yOf = (count: number) => PAD.top + innerHeight - (count / maxCount) * innerHeight;
  const xOf = (index: number) => PAD.left + slot * (index + 0.5);

  const marker = (value: number) => {
    if (bins.length === 0) return null;
    const span = bins[bins.length - 1]?.to ?? 1;
    return PAD.left + (Math.min(value, span) / Math.max(span, 1)) * innerWidth;
  };

  const markers = [
    { key: "p50", value: histogram.p50, label: `${labels.p50} · ${money.format(histogram.p50)}` },
    { key: "p95", value: histogram.p95, label: `${labels.p95} · ${money.format(histogram.p95)}` },
  ].filter((item) => item.value > 0);

  return (
    <figure className="m-0 flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${labels.samples}: ${number.format(histogram.samples)} · ${labels.mean}: ${money.format(histogram.mean)} · ${labels.p50}: ${money.format(
          histogram.p50,
        )} · ${labels.p95}: ${money.format(histogram.p95)}`}
      >
        {Array.from({ length: 4 }, (_, index) => (maxCount / 3) * index).map((value) => (
          <g key={`grid-${value}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yOf(value)}
              y2={yOf(value)}
              stroke="var(--md-outline-variant)"
              strokeWidth="1"
              strokeDasharray={value === 0 ? undefined : "2 6"}
            />
            <text x={PAD.left - 8} y={yOf(value) + 4} textAnchor="end" fontSize="11" fill="var(--md-on-surface-variant)">
              {number.format(Math.round(value))}
            </text>
          </g>
        ))}

        {bins.map((bin, index) => {
          const height = Math.max(bin.count > 0 ? 2 : 0, PAD.top + innerHeight - yOf(bin.count));
          return (
            <g key={bin.label}>
              <rect
                x={xOf(index) - barWidth / 2}
                y={yOf(bin.count)}
                width={barWidth}
                height={height}
                fill="var(--md-primary)"
                opacity={bin.count > 0 ? 0.7 : 0.18}
              />
              <text
                x={xOf(index)}
                y={HEIGHT - 24}
                textAnchor="middle"
                fontSize="10"
                fill="var(--md-on-surface-variant)"
              >
                {index % Math.max(1, Math.ceil(bins.length / 6)) === 0 ? money.format(bin.from) : ""}
              </text>
            </g>
          );
        })}

        {markers.map((item) => {
          const x = marker(item.value);
          if (x === null) return null;
          return (
            <g key={item.key}>
              <line
                x1={x}
                x2={x}
                y1={PAD.top - 4}
                y2={PAD.top + innerHeight}
                stroke="var(--md-tertiary)"
                strokeWidth="1.25"
                strokeDasharray="4 4"
              />
              <text
                x={Math.min(x, WIDTH - PAD.right - 90)}
                y={PAD.top - 8}
                fontSize="11"
                fill="var(--md-on-surface-variant)"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-on-surface-variant">
        {[
          [labels.samples, number.format(histogram.samples)],
          [labels.mean, money.format(histogram.mean)],
          [labels.p50, money.format(histogram.p50)],
          [labels.p95, money.format(histogram.p95)],
          [labels.max, money.format(histogram.max)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt>{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>

      <ChartLegend items={[{ label: labels.count, swatch: <span className="block size-3 bg-primary/70" /> }]} />

      <ChartDataTable
        summary={labels.table}
        columns={[labels.range, labels.count, labels.share]}
        rows={bins.map((bin) => [
          `${money.format(bin.from)} — ${money.format(bin.to)}`,
          number.format(bin.count),
          histogram.samples > 0 ? `${Math.round((bin.count / histogram.samples) * 100)}%` : "0%",
        ])}
      />
    </figure>
  );
}
