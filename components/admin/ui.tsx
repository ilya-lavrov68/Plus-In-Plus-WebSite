import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Общие примитивы админки в стиле Material Design 3.
 *
 * Тени запрещены правилами проекта (docs/ui-ux-pro-max.md), поэтому глубина
 * строится tonal-поверхностями MD3: surface → surface-container → …-high.
 * Все пары «текст/фон» берутся из ролей `on-*`, поэтому контраст не зависит
 * от того, какую поверхность выбрал конкретный экран.
 */

/** Классы полей ввода: outlined text field MD3. */
export const adminInputClass =
  "h-11 w-full rounded-lg border border-outline bg-surface-container-lowest px-3.5 text-sm text-on-surface outline-none transition-[border-color,outline-color] duration-200 placeholder:text-on-surface-variant/70 hover:border-outline focus-visible:border-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export const adminSelectClass = `${adminInputClass} appearance-none pr-9`;

export const adminLabelClass = "flex flex-col gap-1.5 text-sm font-medium text-on-surface";

export const adminHintClass = "text-xs leading-relaxed text-on-surface-variant";

export const adminFieldsetClass =
  "flex flex-col gap-5 rounded-2xl bg-surface-container p-5 sm:p-6";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-[0.16em] text-on-surface-variant uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-medium text-on-surface sm:text-[1.75rem] sm:leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
  as = "section",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  const Tag = as;
  return (
    <Tag className={cn("rounded-2xl bg-surface-container p-5 sm:p-6", className)}>
      {title || description || actions ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-medium text-on-surface">{title}</h2> : null}
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

export type AdminStatusTone = "success" | "error" | "info" | "warning";

const statusToneClasses: Record<AdminStatusTone, string> = {
  success: "bg-primary-container text-on-primary-container",
  error: "bg-error-container text-on-error-container",
  warning: "bg-secondary-container text-on-secondary-container",
  info: "bg-surface-container-high text-on-surface",
};

/**
 * Статус операции. Цвет — только подкрепление: у полосы есть `role`
 * (status/alert) и текстовое сообщение, поэтому результат понятен и без цвета.
 */
export function AdminStatus({
  tone,
  children,
  className,
}: {
  tone: AdminStatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed",
        statusToneClasses[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export type AdminChipTone = "neutral" | "primary" | "tertiary" | "error";

const chipToneClasses: Record<AdminChipTone, string> = {
  neutral: "bg-surface-container-highest text-on-surface-variant",
  primary: "bg-primary-container text-on-primary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error-container text-on-error-container",
};

export function AdminChip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: AdminChipTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        chipToneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Заливная кнопка MD3 (filled) для native-форм без shadcn. */
export const adminFilledButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

/** Тональная кнопка MD3 (filled tonal). */
export const adminTonalButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary-container px-6 text-sm font-medium text-on-secondary-container transition-colors duration-200 hover:bg-secondary-container/80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

/** Текстовая кнопка MD3 (text). */
export const adminTextButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/12 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
