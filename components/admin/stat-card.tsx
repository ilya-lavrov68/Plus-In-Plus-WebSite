import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * KPI-карточка в тональности Material 3: tonal-поверхность вместо тени,
 * подпись — on-surface-variant, значение — on-surface.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-5",
        accent ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[11px] font-medium tracking-[0.14em] uppercase",
            accent ? "text-on-primary-container/80" : "text-on-surface-variant",
          )}
        >
          {label}
        </p>
        {icon ? (
          <span aria-hidden="true" className={accent ? "text-on-primary-container" : "text-on-surface-variant"}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="text-[1.75rem] font-medium leading-none tabular-nums">{value}</p>
      {hint ? (
        <p
          className={cn(
            "text-xs leading-snug",
            accent ? "text-on-primary-container/80" : "text-on-surface-variant",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-surface-container p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-on-surface">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
