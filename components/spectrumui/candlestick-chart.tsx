"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface CandlePoint {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlestickChartLabels {
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  empty: string;
}

export interface CandlestickChartProps {
  data: CandlePoint[];
  labels: CandlestickChartLabels;
  valueKind?: "money" | "number";
  currency?: string;
  volumeKind?: "money" | "number";
  className?: string;
}

const VIEW_W = 760;
const VIEW_H = 300;
const PAD_LEFT = 58;
const PAD_RIGHT = 10;
const PAD_TOP = 12;
const AXIS_H = 22;
const VOLUME_H = 44;
const VOLUME_GAP = 10;

const UP = "#34d399";
const DOWN = "#f87171";
const FLAT = "#71717a";
const GRID = "rgba(250, 250, 250, 0.08)";
const TEXT_MUTED = "rgba(250, 250, 250, 0.56)";

function useFormatters(valueKind: "money" | "number", currency: string) {
  return React.useMemo(() => {
    const money = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
    const format = (value: number, kind: "money" | "number" = valueKind) =>
      kind === "money" ? money.format(value / 100) : number.format(value);
    const formatAxis = (value: number) => {
      const amount = valueKind === "money" ? value / 100 : value;
      const abs = Math.abs(amount);
      const short =
        abs >= 1_000_000
          ? `${number.format(Math.round(amount / 100_000) / 10)} млн`
          : abs >= 10_000
            ? `${number.format(Math.round(amount / 1000))} тыс`
            : number.format(Math.round(amount));
      return valueKind === "money" ? `${short} ₽` : short;
    };
    return { format, formatAxis };
  }, [valueKind, currency]);
}

export function CandlestickChart({
  data,
  labels,
  valueKind = "money",
  currency = "RUB",
  volumeKind,
  className,
}: CandlestickChartProps) {
  const [active, setActive] = React.useState<number | null>(null);
  const { format, formatAxis } = useFormatters(valueKind, currency);
  const volKind = volumeKind ?? valueKind;

  if (!data.length) {
    return (
      <div
        className={cn(
          "flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground",
          className
        )}
      >
        {labels.empty}
      </div>
    );
  }

  const hasVolume = data.some((point) => (point.volume ?? 0) > 0);
  const plotBottom = VIEW_H - AXIS_H - (hasVolume ? VOLUME_H + VOLUME_GAP : 0);
  const plotH = plotBottom - PAD_TOP;
  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;

  const min = Math.min(...data.map((point) => point.low));
  const max = Math.max(...data.map((point) => point.high));
  const span = Math.max(1, max - min);
  const padded = span * 0.08;
  const yMin = Math.max(0, min - padded);
  const yMax = max + padded;
  const yToPx = (value: number) =>
    plotBottom - ((value - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const maxVolume = Math.max(1, ...data.map((point) => point.volume ?? 0));

  const step = plotW / data.length;
  const bodyW = Math.min(26, Math.max(4, step * 0.55));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: PAD_TOP + plotH * fraction,
    value: yMax - (yMax - yMin) * fraction,
  }));

  const activePoint = active !== null ? data[active] : null;
  const activeCenter = active !== null ? PAD_LEFT + step * active + step / 2 : 0;
  const tooltipOnLeft = activeCenter > VIEW_W / 2;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        className="block w-full"
        onMouseLeave={() => setActive(null)}
      >
        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={PAD_LEFT}
              x2={VIEW_W - PAD_RIGHT}
              y1={line.y}
              y2={line.y}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={line.y + 3.5}
              textAnchor="end"
              fontSize={11}
              fill={TEXT_MUTED}
            >
              {formatAxis(line.value)}
            </text>
          </g>
        ))}

        {data.map((point, index) => {
          const center = PAD_LEFT + step * index + step / 2;
          const rising = point.close >= point.open;
          const moved = point.close !== point.open || point.high !== point.low;
          const color = !moved ? FLAT : rising ? UP : DOWN;
          const bodyTop = yToPx(Math.max(point.open, point.close));
          const bodyBottom = yToPx(Math.min(point.open, point.close));
          const bodyH = Math.max(2, bodyBottom - bodyTop);
          const isActive = active === index;

          return (
            <g key={point.date} onMouseEnter={() => setActive(index)}>
              <rect
                x={PAD_LEFT + step * index}
                y={PAD_TOP}
                width={step}
                height={VIEW_H - PAD_TOP - AXIS_H}
                fill={isActive ? "rgba(250, 250, 250, 0.04)" : "transparent"}
              />
              <line
                x1={center}
                x2={center}
                y1={yToPx(point.high)}
                y2={yToPx(point.low)}
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <rect
                x={center - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                rx={2}
                fill={rising && moved ? color : moved ? color : FLAT}
                fillOpacity={rising && moved ? 0.9 : 1}
                stroke={color}
                strokeWidth={1}
              />
              {hasVolume ? (
                <rect
                  x={center - bodyW / 2}
                  y={
                    plotBottom +
                    VOLUME_GAP +
                    (VOLUME_H - ((point.volume ?? 0) / maxVolume) * VOLUME_H)
                  }
                  width={bodyW}
                  height={Math.max(
                    point.volume ? 2 : 0,
                    ((point.volume ?? 0) / maxVolume) * VOLUME_H
                  )}
                  rx={1.5}
                  fill={color}
                  fillOpacity={isActive ? 0.55 : 0.3}
                />
              ) : null}
              {index % labelEvery === 0 ? (
                <text
                  x={center}
                  y={VIEW_H - 6}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={TEXT_MUTED}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute top-2 z-10 w-48 rounded-xl border border-border bg-popover p-3 text-xs shadow-lg"
          style={
            tooltipOnLeft
              ? { right: `${100 - (activeCenter / VIEW_W) * 100 + 2}%` }
              : { left: `${(activeCenter / VIEW_W) * 100 + 2}%` }
          }
        >
          <p className="font-semibold text-popover-foreground">{activePoint.label}</p>
          <dl className="mt-1.5 space-y-1 text-muted-foreground">
            {(
              [
                [labels.open, activePoint.open],
                [labels.high, activePoint.high],
                [labels.low, activePoint.low],
                [labels.close, activePoint.close],
              ] as const
            ).map(([caption, value]) => (
              <div key={caption} className="flex items-baseline justify-between gap-3">
                <dt>{caption}</dt>
                <dd className="font-medium tabular-nums text-popover-foreground">
                  {format(value)}
                </dd>
              </div>
            ))}
            {labels.volume && activePoint.volume !== undefined ? (
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1">
                <dt>{labels.volume}</dt>
                <dd className="font-medium tabular-nums text-popover-foreground">
                  {format(activePoint.volume, volKind)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p
            className={cn(
              "mt-1.5 text-right font-semibold tabular-nums",
              activePoint.close >= activePoint.open ? "text-emerald-400" : "text-red-400"
            )}
          >
            {activePoint.close >= activePoint.open ? "▲" : "▼"}{" "}
            {activePoint.open
              ? `${(((activePoint.close - activePoint.open) / activePoint.open) * 100).toFixed(1)}%`
              : "—"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
