"use client";

import * as React from "react";

import type { RequestLocale } from "@/lib/request-locale";
import type { Candle } from "@/lib/finance-math";
import { cn } from "@/lib/utils";

import { ChartDataTable, ChartLegend } from "./chart-frame";
import { moneyFormatter, numberFormatter } from "./format";

export interface CandleLabels {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  activeDays: string;
  up: string;
  down: string;
  table: string;
  date: string;
  /** Подсказка для клавиатуры: стрелки двигают курсор по свечам. */
  keyboard: string;
}

const WIDTH = 900;
const HEIGHT = 360;
const PAD = { top: 16, right: 16, bottom: 30, left: 64 };
const VOLUME_HEIGHT = 62;
const VOLUME_GAP = 14;

/**
 * Свечной график: OHLC сумм заказов по дням плюс объёмная панель.
 *
 * Направление свечи читается формой, а не только цветом: растущая свеча полая,
 * падающая залита — так график остаётся понятным на слабом контрасте и при
 * дальтонизме. Курсор «прилипает» к ближайшей свече, по стрелкам клавиатуры
 * двигается так же; точные значения дублируются таблицей под графиком.
 */
export function CandleChart({
  candles,
  labels,
  locale,
  currency = "RUB",
}: {
  candles: Candle[];
  labels: CandleLabels;
  locale: RequestLocale;
  currency?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const money = React.useMemo(() => moneyFormatter(locale, { currency }), [locale, currency]);
  const moneyCompact = React.useMemo(() => moneyFormatter(locale, { currency, compact: true }), [locale, currency]);
  const count = React.useMemo(() => numberFormatter(locale), [locale]);

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const priceHeight = HEIGHT - PAD.top - PAD.bottom - VOLUME_HEIGHT - VOLUME_GAP;
  const volumeTop = PAD.top + priceHeight + VOLUME_GAP;

  const geometry = React.useMemo(() => {
    if (candles.length === 0) return null;
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const rawMax = Math.max(...highs);
    const rawMin = Math.min(...lows);
    const pad = Math.max((rawMax - rawMin) * 0.12, 1);
    const max = rawMax + pad;
    const min = Math.max(0, rawMin - pad);
    const span = Math.max(max - min, 1);
    const slot = innerWidth / candles.length;
    const body = Math.min(Math.max(slot * 0.62, 2), 16);
    const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
    return { min, span, slot, body, maxVolume, max };
  }, [candles, innerWidth]);

  const xOf = (index: number) => PAD.left + (geometry ? geometry.slot * (index + 0.5) : innerWidth / 2);
  const yOf = (value: number) =>
    PAD.top + priceHeight - (geometry ? ((value - geometry.min) / geometry.span) * priceHeight : 0);

  const activeCandle = active !== null ? candles[active] : undefined;
  const gridValues = geometry
    ? Array.from({ length: 5 }, (_, index) => geometry.min + (geometry.span / 4) * index)
    : [];

  const labelIndexes = candles.length > 1 ? [0, Math.floor((candles.length - 1) / 2), candles.length - 1] : [0];

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const index = Math.round((x - PAD.left) / geometry.slot - 0.5);
    setActive(Math.min(candles.length - 1, Math.max(0, index)));
  };

  const move = (delta: number) => {
    setActive((current) => {
      const next = (current ?? candles.length - 1) + delta;
      return Math.min(candles.length - 1, Math.max(0, next));
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(candles.length - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  if (!geometry) {
    return null;
  }

  const last = candles[candles.length - 1];
  const summary =
    last === undefined
      ? ""
      : `${labels.close}: ${money.format(last.close)} · ${labels.open}: ${money.format(last.open)} · ${labels.high}: ${money.format(
          last.high,
        )} · ${labels.low}: ${money.format(last.low)}`;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={summary}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={handleKeyDown}
          onBlur={() => setActive(null)}
        >
          {gridValues.map((value) => (
            <g key={`grid-${value}`}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yOf(value)}
                y2={yOf(value)}
                stroke="var(--md-outline-variant)"
                strokeWidth="1"
                strokeDasharray="2 6"
              />
              <text x={PAD.left - 10} y={yOf(value) + 4} textAnchor="end" fontSize="11" fill="var(--md-on-surface-variant)">
                {moneyCompact.format(value)}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={volumeTop - VOLUME_GAP / 2}
            y2={volumeTop - VOLUME_GAP / 2}
            stroke="var(--md-outline-variant)"
            strokeWidth="1"
          />

          {candles.map((candle, index) => {
            const rising = candle.close >= candle.open;
            const x = xOf(index);
            const top = yOf(Math.max(candle.open, candle.close));
            const bottom = yOf(Math.min(candle.open, candle.close));
            const height = Math.max(1.5, bottom - top);
            const volumeHeight = Math.max(1, (candle.volume / geometry.maxVolume) * VOLUME_HEIGHT);
            return (
              <g key={candle.key} opacity={active === null || active === index ? 1 : 0.55}>
                <line
                  x1={x}
                  x2={x}
                  y1={yOf(candle.high)}
                  y2={yOf(candle.low)}
                  stroke={rising ? "var(--md-on-surface)" : "var(--md-on-surface-variant)"}
                  strokeWidth="1.25"
                />
                <rect
                  x={x - geometry.body / 2}
                  y={top}
                  width={geometry.body}
                  height={height}
                  rx="1"
                  fill={rising ? "var(--md-surface-container-low)" : "var(--md-outline)"}
                  stroke={rising ? "var(--md-on-surface)" : "var(--md-outline)"}
                  strokeWidth="1.25"
                />
                <rect
                  x={x - geometry.body / 2}
                  y={volumeTop + VOLUME_HEIGHT - volumeHeight}
                  width={geometry.body}
                  height={volumeHeight}
                  fill={rising ? "var(--md-primary)" : "var(--md-outline)"}
                  opacity="0.45"
                />
              </g>
            );
          })}

          {active !== null && activeCandle ? (
            <g pointerEvents="none">
              <line
                x1={xOf(active)}
                x2={xOf(active)}
                y1={PAD.top}
                y2={volumeTop + VOLUME_HEIGHT}
                stroke="var(--md-on-surface)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yOf(activeCandle.close)}
                y2={yOf(activeCandle.close)}
                stroke="var(--md-on-surface)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.7"
              />
            </g>
          ) : null}

          {labelIndexes.map((index) => {
            const candle = candles[index];
            if (!candle) return null;
            return (
              <text
                key={`label-${candle.key}`}
                x={xOf(index)}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? "start" : index === candles.length - 1 ? "end" : "middle"}
                fontSize="11"
                fill="var(--md-on-surface-variant)"
              >
                {candle.label}
              </text>
            );
          })}
        </svg>

        {active !== null && activeCandle ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg bg-surface-container-highest p-3 text-xs"
            style={{
              left: `calc(${((xOf(active) / WIDTH) * 100).toFixed(2)}% ${xOf(active) > WIDTH * 0.6 ? "- 11.5rem" : "+ 0.75rem"})`,
            }}
          >
            <p className="mb-2 font-medium text-on-surface">{activeCandle.label}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                [labels.open, money.format(activeCandle.open)],
                [labels.close, money.format(activeCandle.close)],
                [labels.high, money.format(activeCandle.high)],
                [labels.low, money.format(activeCandle.low)],
                [labels.volume, money.format(activeCandle.volume)],
                [labels.activeDays, count.format(activeCandle.activeDays)],
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="text-right tabular-nums text-on-surface">{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {activeCandle
          ? `${activeCandle.label}: ${labels.open} ${money.format(activeCandle.open)}, ${labels.close} ${money.format(
              activeCandle.close,
            )}, ${labels.high} ${money.format(activeCandle.high)}, ${labels.low} ${money.format(activeCandle.low)}`
          : ""}
      </p>

      <ChartLegend
        items={[
          {
            label: labels.up,
            swatch: <CandleGlyph filled={false} />,
          },
          {
            label: labels.down,
            swatch: <CandleGlyph filled />,
          },
          {
            label: labels.volume,
            swatch: <span className="block h-3 w-2 bg-primary/45" />,
          },
        ]}
      />

      <p className={cn("text-xs text-on-surface-variant")}>{labels.keyboard}</p>

      <ChartDataTable
        summary={labels.table}
        columns={[labels.date, labels.open, labels.high, labels.low, labels.close, labels.volume, labels.activeDays]}
        rows={candles
          .slice(-40)
          .reverse()
          .map((candle) => [
            candle.label,
            money.format(candle.open),
            money.format(candle.high),
            money.format(candle.low),
            money.format(candle.close),
            money.format(candle.volume),
            count.format(candle.activeDays),
          ])}
      />
    </figure>
  );
}

/** Мини-свеча для легенды: полая — рост, залитая — падение. */
function CandleGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
      <line x1="6" x2="6" y1="0" y2="14" stroke="var(--md-on-surface-variant)" strokeWidth="1" />
      <rect
        x="2.5"
        y="3"
        width="7"
        height="8"
        rx="1"
        fill={filled ? "var(--md-outline)" : "var(--md-surface-container-low)"}
        stroke={filled ? "var(--md-outline)" : "var(--md-on-surface)"}
        strokeWidth="1.25"
      />
    </svg>
  );
}
