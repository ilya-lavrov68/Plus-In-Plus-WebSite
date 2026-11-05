import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Общие примитивы админки в стиле Material Design 3.
 *
 * Тени запрещены правилами проекта (docs/ui-ux-pro-max.md), поэтому глубина
 * строится tonal-поверхностями MD3: surface → surface-container → …-high.
 * Все пары «текст/фон» берутся из ролей `on-*`, поэтому контраст не зависит
 * от того, какую поверхность выбрал конкретный экран.
 */

/**
 * Поле ввода — тёмный «колодец» на светлой панели.
 *
 * Границу поля задаёт поверхность: подложка на два шага темнее панели плюс
 * хайрлайн `outline-variant/45` — тонкая линия внутри поля, без внешней рамки.
 * Фокус добавляет контур и подсветку подложки.
 */
const adminFieldSurface =
  "w-full rounded-lg bg-surface-container-lowest px-3.5 text-sm text-on-surface caret-primary ring-1 ring-inset ring-outline-variant/45 outline-none transition-[background-color,outline-color] duration-200 placeholder:text-on-surface-variant/70 hover:bg-surface-container-low focus-visible:bg-surface-container focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export const adminInputClass = `h-11 ${adminFieldSurface}`;

export const adminSelectClass = `${adminInputClass} appearance-none pr-9`;

/**
 * Многострочное поле собирается из той же поверхности без фиксированной
 * высоты: `h-auto` поверх `h-11` зависел бы от порядка классов в CSS.
 */
export const adminTextareaClass = `min-h-24 resize-y py-2.5 leading-relaxed ${adminFieldSurface}`;

export const adminLabelClass = "flex flex-col gap-2 text-sm font-medium text-on-surface";

/** Подпись под полем: что произойдёт и какие ограничения у значения. */
export const adminLabelHintClass = "text-xs font-normal leading-relaxed text-on-surface-variant";

export const adminHintClass = "text-xs leading-relaxed text-on-surface-variant";

export const adminFieldsetClass =
  "flex flex-col gap-5 rounded-2xl bg-surface-container-low p-5 sm:p-6";

/** Вложенный блок внутри формы: группа полей на чуть более тёмной подложке. */
export const adminInsetPanelClass =
  "flex flex-col gap-4 rounded-xl bg-surface-container p-4 sm:p-5";

/**
 * Группа полей: подпись-«чип» и подложка на шаг светлее панели.
 *
 * Нужна там, где на одном экране несколько независимых наборов (например,
 * каждая веха истории). Без неё поля разных наборов сливаются в один список и
 * непонятно, что к чему относится.
 */
export function AdminFieldGroup({
  legend,
  hint,
  children,
  className,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl bg-surface-container p-4 sm:p-5",
        className,
      )}
    >
      <legend className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-medium text-on-surface">
        {legend}
      </legend>
      {hint ? <p className="text-xs leading-relaxed text-on-surface-variant">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {back ? (
          <Link
            href={back.href}
            className="mb-1 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span aria-hidden="true">←</span>
            {back.label}
          </Link>
        ) : null}
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
    <Tag className={cn("rounded-2xl bg-surface-container-low p-5 sm:p-6", className)}>
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

/**
 * Кнопки MD3. Вариант задаёт пару «фон/текст» из ролей, поэтому текст всегда
 * читаем: заливная — `primary` + `on-primary`, тональная — `secondary-container`
 * + `on-secondary-container`, контурная — прозрачный фон + рамка `outline`.
 *
 * Правило экрана: заливная кнопка одна — главное действие страницы. Действия
 * в строках таблиц и повторяющиеся кнопки — тональные или контурные, иначе
 * десяток жёлтых плашек превращает список в световую стену.
 */
const adminButtonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors duration-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

/*
 * Кнопки собраны по одному правилу: спокойная подложка и нейтральный текст.
 * Светлая (filled) кнопка при наведении просто темнеет на один шаг — цвет
 * текста и оттенок не меняются, поэтому нажатие читается как «нажали», а не
 * как «переключили режим». Жёлтого в панели нет вовсе.
 */
const adminButtonVariants = {
  filled: "bg-on-surface text-surface hover:bg-on-surface/88",
  tonal: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
  outlined:
    "text-on-surface hover:bg-on-surface/8",
  text: "text-on-surface-variant hover:bg-on-surface/8",
  danger: "text-error hover:bg-error/12 hover:text-error",
} as const;

const adminButtonSizes = {
  md: "h-10 px-5",
  sm: "h-9 px-3.5 text-xs",
} as const;

export type AdminButtonVariant = keyof typeof adminButtonVariants;
export type AdminButtonSize = keyof typeof adminButtonSizes;

/** Единая кнопка админки: `adminButton("filled", "sm")`. */
export function adminButton(
  variant: AdminButtonVariant = "tonal",
  size: AdminButtonSize = "md",
): string {
  return `${adminButtonBase} ${adminButtonVariants[variant]} ${adminButtonSizes[size]}`;
}

/** Заливная кнопка MD3 (filled) — главное действие экрана. */
export const adminFilledButtonClass = adminButton("filled");
/** Тональная кнопка MD3 (filled tonal) — вторичные действия. */
export const adminTonalButtonClass = adminButton("tonal");
/** Контурная кнопка MD3 (outlined) — действия в строках таблиц и списках. */
export const adminOutlinedButtonClass = adminButton("outlined");
/** Текстовая кнопка MD3 (text). */
export const adminTextButtonClass = adminButton("text");
/** Опасное действие: только текст `error` и мягкая подложка при наведении. */
export const adminDangerButtonClass = adminButton("danger");
