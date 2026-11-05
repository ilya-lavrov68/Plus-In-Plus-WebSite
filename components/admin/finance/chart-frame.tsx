"use client";

import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Общая рамка финансового графика: заголовок, диапазоны, тело, легенда и
 * таблица значений.
 *
 * Таблица нужна не «на всякий случай»: график читается цветом и формой, а
 * точные числа должны быть доступны клавиатуре и screen reader. Поэтому под
 * каждым графиком лежит раскрывающийся `<details>` с теми же данными.
 */

export interface RangeOption {
  value: string;
  label: string;
}

export function RangeTabs({
  options,
  value,
  onChange,
  label,
  pending = false,
}: {
  options: RangeOption[];
  value: string;
  onChange: (range: string) => void;
  label: string;
  pending?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending || undefined}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-container p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200",
            "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            value === option.value
              ? "bg-surface-container-highest text-on-surface"
              : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  toolbar,
  meta,
  legend,
  empty,
  isEmpty = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  meta?: React.ReactNode;
  legend?: React.ReactNode;
  empty: string;
  isEmpty?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("flex min-w-0 flex-col gap-4 rounded-2xl bg-surface-container-low p-5 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-on-surface">{title}</h2>
          {description ? <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{description}</p> : null}
        </div>
        {toolbar}
      </div>

      {meta}

      {isEmpty ? <p className="text-sm text-on-surface-variant">{empty}</p> : children}

      {legend}
    </section>
  );
}

/** Плотная таблица значений под графиком: клавиатурный путь к точным числам. */
export function ChartDataTable({
  summary,
  columns,
  rows,
}: {
  summary: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group rounded-xl bg-surface-container/60 px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-on-surface-variant transition-colors duration-200 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {summary}
      </summary>
      <div className="mt-3 max-h-64 overflow-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="h-9 px-3 text-[10px]">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row[0]}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`${cellIndex}-${String(cell)}`}
                    className={cn("px-3 py-2", cellIndex === 0 ? "text-on-surface" : "tabular-nums text-on-surface-variant")}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

/** Легенда: цвет плюс форма, поэтому смысл не держится на одном цвете. */
export function ChartLegend({ items }: { items: { label: string; value?: string; swatch: React.ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-on-surface-variant">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex shrink-0">
            {item.swatch}
          </span>
          <span>{item.label}</span>
          {item.value ? <span className="tabular-nums text-on-surface">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Заглушка на время стриминга: блоки той же высоты, что и график, чтобы
 * страница не прыгала. Без «пульсации» — движение здесь ничего не сообщает,
 * а при reduced motion оно лишнее.
 */
export function ChartSkeleton({ title, hint, className }: { title: string; hint: string; className?: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={title}
      className={cn("flex flex-col gap-4 rounded-2xl bg-surface-container-low p-5 sm:p-6", className)}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-on-surface">{title}</h2>
        <p className="text-sm text-on-surface-variant">{hint}</p>
      </div>
      <div aria-hidden="true" className="flex h-[300px] items-end gap-2 rounded-xl bg-surface-container/60 p-4">
        {[38, 62, 44, 78, 52, 88, 66, 72, 48, 84, 58, 68].map((height, index) => (
          <span key={index} className="flex-1 bg-surface-container-high" style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}
