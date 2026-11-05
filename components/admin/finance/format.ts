import type { RequestLocale } from "@/lib/request-locale";

/**
 * Форматирование денег и чисел для графиков.
 *
 * Локаль передаётся явно: клиентские панели рендерятся и на сервере, поэтому
 * `navigator.language` недоступен и сравнивать нечего.
 */

export function moneyFormatter(locale: RequestLocale, options: { compact?: boolean; currency?: string } = {}) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: options.currency ?? "RUB",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    notation: options.compact ? "compact" : "standard",
    compactDisplay: "short",
  });
}

export function numberFormatter(locale: RequestLocale, options: { compact?: boolean } = {}) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    maximumFractionDigits: options.compact ? 1 : 0,
    notation: options.compact ? "compact" : "standard",
  });
}

/** Проценты со знаком: `+12,4%`, `−3,1%`, `0%`. */
export function signedPercent(value: number, locale: RequestLocale, digits = 1): string {
  if (!Number.isFinite(value) || value === 0) return "0%";
  const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  return `${value > 0 ? "+" : "−"}${formatted}%`;
}

/** Округление вверх до приятного шага оси — чтобы подписи не были «рваными». */
export function axisMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
