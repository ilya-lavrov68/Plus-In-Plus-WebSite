"use client";

import * as React from "react";

import type { PortfolioSeries } from "@/lib/finance-math";
import type { RequestLocale } from "@/lib/request-locale";

import { ChartDataTable, ChartLegend } from "./chart-frame";
import { axisMax, moneyFormatter, signedPercent } from "./format";

export interface PortfolioLabels {
  value: string;
  basis: string;
  drawdown: string;
  maxDrawdown: string;
  delta: string;
  total: string;
  table: string;
  date: string;
  valueColumn: string;
  basisColumn: string;
  drawdownColumn: string;
  windowHint: string;
}

const WIDTH = 900;
const HEIGHT = 300;
const PAD = { top: 18, right: 16, bottom: 28, left: 64 };

/**
 * Портфель: стоимость против базовой линии, просадка от бегущего пика залита
 * под линией.
 *
 * «Стоимость» — выручка за скользящее окно, «база» — средний темп с начала
 * периода. Пик берётся бегущий, поэтому просадка показывает не разницу с базой
 * (она бывает и положительной), а именно отставание от лучшей точки — это и
 * закрашивается штриховкой.
 */
export function PortfolioChart({
  series,
  labels,
  locale,
  currency = "RUB",
}: {
  series: PortfolioSeries;
  labels: PortfolioLabels;
  locale: RequestLocale;
  currency?: string;
}) {
  const money = React.useMemo(() => moneyFormatter(locale, { currency }), [locale, currency]);
  const moneyCompact = React.useMemo(() => moneyFormatter(locale, { currency, compact: true }), [locale, currency]);
  const points = series.points;

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = axisMax(Math.max(...points.map((point) => Math.max(point.peak, point.basis)), 1) * 1.05);

  const xOf = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * innerWidth : innerWidth / 2);
  const yOf = (value: number) => PAD.top + innerHeight - (Math.max(0, value) / max) * innerHeight;

  const linePath = (key: "smoothed" | "basis", step = false) => {
    if (points.length === 0) return "";
    return points
      .map((point, index) => {
        const value = point[key];
        if (index === 0) return `M${xOf(0).toFixed(1)},${yOf(value).toFixed(1)}`;
        const previous = points[index - 1];
        if (step && previous) {
          return `L${xOf(index).toFixed(1)},${yOf(previous[key]).toFixed(1)} L${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`;
        }
        return `L${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`;
      })
      .join(" ");
  };

  /** Заливка под линией стоимости до нуля — «площадь» портфеля. */
  const areaPath =
    points.length > 0
      ? `${linePath("smoothed")} L${xOf(points.length - 1).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)} L${PAD.left},${(
          PAD.top + innerHeight
        ).toFixed(1)} Z`
      : "";

  /** Просадка: сверху идём по пику, снизу возвращаемся по стоимости. */
  const drawdownPath = (() => {
    const dips = points
      .map((point, index) => ({ point, index }))
      .filter((entry) => entry.point.drawdown > 0);
    if (dips.length === 0) return "";
    const top = dips.map(({ point, index }) => `${index === dips[0]?.index ? "M" : "L"}${xOf(index).toFixed(1)},${yOf(point.peak).toFixed(1)}`);
    const bottom = [...dips]
      .reverse()
      .map(({ point, index }) => `L${xOf(index).toFixed(1)},${yOf(point.smoothed).toFixed(1)}`);
    return `${top.join(" ")} ${bottom.join(" ")} Z`;
  })();

  const ticks = Array.from({ length: 5 }, (_, index) => (max / 4) * index);
  const labelIndexes = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  const last = points[points.length - 1];

  return (
    <figure className="m-0 flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-on-surface-variant">{labels.value}</dt>
          <dd className="text-lg leading-none font-medium tabular-nums text-on-surface">{money.format(series.current)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-on-surface-variant">{labels.delta}</dt>
          <dd className="text-lg leading-none font-medium tabular-nums text-on-surface">{signedPercent(series.deltaPct, locale)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-on-surface-variant">{labels.total}</dt>
          <dd className="text-lg leading-none font-medium tabular-nums text-on-surface">{money.format(series.total)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-on-surface-variant">{labels.maxDrawdown}</dt>
          <dd className="text-lg leading-none font-medium tabular-nums text-on-surface">
            {signedPercent(series.maxDrawdownPct, locale)}
          </dd>
        </div>
      </dl>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${labels.value}: ${money.format(series.current)} · ${labels.basis}: ${money.format(series.basis)} · ${labels.maxDrawdown}: ${signedPercent(series.maxDrawdownPct, locale)}`}>
        <defs>
          <pattern id="pip-drawdown-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--md-outline-variant)" opacity="0.18" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--md-on-surface-variant)" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>

        {ticks.map((value) => (
          <g key={`tick-${value}`}>
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

        {areaPath ? <path d={areaPath} fill="var(--md-primary)" fillOpacity="0.14" stroke="none" /> : null}
        {drawdownPath ? <path d={drawdownPath} fill="url(#pip-drawdown-hatch)" stroke="none" /> : null}
        <path d={linePath("basis", true)} fill="none" stroke="var(--md-tertiary)" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={linePath("smoothed")} fill="none" stroke="var(--md-primary)" strokeWidth="2.25" strokeLinejoin="round" />
        {last ? <circle cx={xOf(points.length - 1)} cy={yOf(last.smoothed)} r="4" fill="var(--md-primary)" /> : null}

        {labelIndexes.map((index) => {
          const point = points[index];
          if (!point) return null;
          return (
            <text
              key={`label-${point.key}`}
              x={xOf(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fontSize="11"
              fill="var(--md-on-surface-variant)"
            >
              {point.label}
            </text>
          );
        })}
      </svg>

      <ChartLegend
        items={[
          { label: labels.value, value: money.format(series.current), swatch: <span className="block h-0.5 w-4 bg-primary" /> },
          { label: labels.basis, value: money.format(series.basis), swatch: (
              <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true" focusable="false">
                <line x1="0" y1="2" x2="16" y2="2" stroke="var(--md-tertiary)" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            ) },
          {
            label: labels.drawdown,
            value: signedPercent(series.drawdownPct, locale),
            swatch: <span className="block size-3 bg-outline-variant/40" />,
          },
        ]}
      />

      <p className="text-xs text-on-surface-variant">{labels.windowHint}</p>

      <ChartDataTable
        summary={labels.table}
        columns={[labels.date, labels.valueColumn, labels.basisColumn, labels.drawdownColumn]}
        rows={[...points]
          .reverse()
          .filter((_, index) => index % Math.max(1, Math.ceil(points.length / 40)) === 0)
          .map((point) => [point.label, money.format(point.smoothed), money.format(point.basis), signedPercent(point.drawdownPct, locale)])}
      />
    </figure>
  );
}
