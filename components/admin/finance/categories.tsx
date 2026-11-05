"use client";

import * as React from "react";

import type { CategorySeries } from "@/lib/finance-math";
import type { RequestLocale } from "@/lib/request-locale";

import { ChartDataTable, ChartLegend } from "./chart-frame";
import { moneyFormatter } from "./format";

export interface CategoryLabels {
  other: string;
  total: string;
  share: string;
  table: string;
  date: string;
  category: string;
  amount: string;
}

const WIDTH = 900;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

/** Заливки рядов: цвет + штриховка, чтобы серии различались не только цветом. */
const FILLS = [
  { fill: "var(--md-primary)", opacity: "0.62" },
  { fill: "var(--md-tertiary)", opacity: "0.5" },
  { fill: "url(#pip-stack-hatch)", opacity: "1" },
  { fill: "url(#pip-stack-dots)", opacity: "1" },
  { fill: "var(--md-outline)", opacity: "0.42" },
] as const;

/**
 * Структура выручки: stacked area по категориям услуг и товаров.
 *
 * Категории — топ-4 по сумме, остальные сливаются в «Другое». Названия
 * приходят из базы как ключи, поэтому сырые `web`, `print` человекочитаемы не
 * всегда: подписи остаются как есть, но рядом стоит сумма и доля — так список
 * читается без догадок.
 */
/** Плашка легенды повторяет заливку серии: цвет плюс штриховка или точки. */
function Swatch({ index }: { index: number }) {
  const base = index === 0 ? "var(--md-primary)" : index === 1 ? "var(--md-tertiary)" : "var(--md-outline)";
  const style: React.CSSProperties =
    index === 2
      ? { backgroundColor: "var(--md-primary)", opacity: 0.75, backgroundImage: "repeating-linear-gradient(45deg, var(--md-surface-container-low) 0 2px, transparent 2px 5px)" }
      : index === 3
        ? { backgroundColor: "var(--md-tertiary)", opacity: 0.8, backgroundImage: "radial-gradient(var(--md-surface-container-low) 1px, transparent 1.2px)", backgroundSize: "4px 4px" }
        : { backgroundColor: base, opacity: index === 4 ? 0.45 : 0.8 };
  return <span aria-hidden="true" className="block size-3" style={style} />;
}

export function CategoryStack({
  series,
  labels,
  locale,
  currency = "RUB",
}: {
  series: CategorySeries;
  labels: CategoryLabels;
  locale: RequestLocale;
  currency?: string;
}) {
  const money = React.useMemo(() => moneyFormatter(locale, { currency }), [locale, currency]);
  const moneyCompact = React.useMemo(() => moneyFormatter(locale, { currency, compact: true }), [locale, currency]);

  const points = series.dates.length;
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const totalsPerDay = Array.from({ length: points }, (_, index) =>
    series.series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0),
  );
  const max = Math.max(...totalsPerDay, 1);

  const xOf = (index: number) => PAD.left + (points > 1 ? (index / (points - 1)) * innerWidth : innerWidth / 2);
  const yOf = (value: number) => PAD.top + innerHeight - (Math.max(0, value) / max) * innerHeight;

  const labelIndexes = points > 1 ? [0, Math.floor((points - 1) / 2), points - 1] : [0];
  const total = series.series.reduce((sum, item) => sum + item.total, 0);

  /** Полоса каждой серии строится поверх суммы всех предыдущих. */
  const bands = series.series.map((item, seriesIndex) => {
    const lower = series.series
      .slice(0, seriesIndex)
      .reduce<number[]>((acc, previous) => acc.map((value, index) => value + (previous.values[index] ?? 0)), new Array(points).fill(0));
    const upper = lower.map((value, index) => value + (item.values[index] ?? 0));
    const top = upper.map((value, index) => `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`);
    const bottom = [...lower]
      .map((value, index) => ({ value, index }))
      .reverse()
      .map(({ value, index }) => `L${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`);
    return { item, seriesIndex, path: `${top.join(" ")} ${bottom.join(" ")} Z` };
  });

  const readable = (key: string) => (key === "__other" ? labels.other : key);

  return (
    <figure className="m-0 flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={series.series
          .map((item) => `${readable(item.label)}: ${money.format(item.total)}`)
          .join(" · ")}
      >
        <defs>
          <pattern id="pip-stack-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--md-primary)" opacity="0.16" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--md-primary)" strokeWidth="1.5" opacity="0.6" />
          </pattern>
          <pattern id="pip-stack-dots" patternUnits="userSpaceOnUse" width="6" height="6">
            <rect width="6" height="6" fill="var(--md-tertiary)" opacity="0.14" />
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--md-tertiary)" opacity="0.7" />
          </pattern>
        </defs>

        {Array.from({ length: 5 }, (_, index) => (max / 4) * index).map((value) => (
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
            <text x={PAD.left - 10} y={yOf(value) + 4} textAnchor="end" fontSize="11" fill="var(--md-on-surface-variant)">
              {moneyCompact.format(value)}
            </text>
          </g>
        ))}

        {bands.map(({ item, seriesIndex, path }) => {
          const style = FILLS[Math.min(seriesIndex, FILLS.length - 1)] ?? FILLS[4];
          return <path key={item.key} d={path} fill={style.fill} fillOpacity={style.opacity} stroke="none" />;
        })}

        {labelIndexes.map((index) => {
          const key = series.dates[index];
          if (!key) return null;
          return (
            <text
              key={`label-${key}`}
              x={xOf(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === points - 1 ? "end" : "middle"}
              fontSize="11"
              fill="var(--md-on-surface-variant)"
            >
              {series.labels[index]}
            </text>
          );
        })}
      </svg>

      <ChartLegend
        items={series.series.map((item, index) => ({
          label: readable(item.label),
          value: `${money.format(item.total)} · ${total > 0 ? Math.round((item.total / total) * 100) : 0}%`,
          swatch: <Swatch index={index} />,
        }))}
      />

      <ChartDataTable
        summary={labels.table}
        columns={[labels.date, ...series.series.map((item) => readable(item.label)), labels.total]}
        rows={series.dates.map((date, index) => [
          series.labels[index] ?? date,
          ...series.series.map((item) => money.format(item.values[index] ?? 0)),
          money.format(totalsPerDay[index] ?? 0),
        ])}
      />
    </figure>
  );
}
