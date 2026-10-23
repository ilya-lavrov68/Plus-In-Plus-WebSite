import { localizedPath as computeLocalizedPath } from "@/i18n/routing";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "pip-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ru";
}

export function explicitLocaleFromPath(pathname: string): Locale | null {
  const candidate = pathname.split("/")[1];
  return isLocale(candidate) ? candidate : null;
}

export function localeFromPath(pathname: string): Locale {
  const candidate = pathname.split("/")[1];
  return isLocale(candidate) ? candidate : defaultLocale;
}

export function stripLocale(pathname: string): string {
  const locale = pathname.split("/")[1];
  if (!isLocale(locale)) return pathname || "/";
  const rest = pathname.slice(locale.length + 1);
  return rest || "/";
}

export function localizedPath(pathname: string, locale: Locale): string {
  return computeLocalizedPath(pathname, locale);
}

export function formatPostDate(value: Date | string, locale: Locale, withTime = false): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: withTime ? "long" : "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatPublishedDate(value: Date | string, locale: Locale): string {
  const date = new Date(value);
  const language = locale === "ru" ? "ru-RU" : "en-US";
  const day = new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  const time = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${day}${locale === "ru" ? " в " : " at "}${time}`;
}

export const messages = { en, ru } as const;
