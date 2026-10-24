"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  explicitLocaleFromPath,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n";
import { isUnprefixedProtectedPath, localizedPath } from "@/i18n/routing";

const labels: Record<Locale, string> = { en: "English", ru: "Русский" };
const ONE_YEAR = 60 * 60 * 24 * 365;

export { isUnprefixedProtectedPath, localizedPath };

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const activeLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Use explicit URL prefix (/en or /ru) if present; otherwise trust NextIntl's activeLocale!
  // Previously `localeFromPath(pathname) || activeLocale` always returned "en" on unprefixed URLs
  // (e.g. /services, /contact, /orders), causing RU -> EN clicks to early-return as a no-op.
  const locale: Locale = explicitLocaleFromPath(pathname) ?? activeLocale;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const changeLocale = (nextLocale: Locale) => {
    setOpen(false);
    if (nextLocale === locale) return;

    try {
      window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${ONE_YEAR}; SameSite=Lax${secure}`;
    } catch {
      // Storage disabled fallback
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const target = localizedPath(pathname, nextLocale, search, hash);
    const firstSegment = pathname.split("/")[1];
    const stripped =
      firstSegment === "en" || firstSegment === "ru"
        ? pathname.slice(firstSegment.length + 1) || "/"
        : pathname;

    startTransition(() => {
      if (isUnprefixedProtectedPath(stripped)) {
        if (firstSegment === "en" || firstSegment === "ru") {
          router.replace(target);
        }
        router.refresh();
      } else {
        router.push(target);
        router.refresh();
      }
    });
  };

  return (
    <div ref={rootRef} className="relative block">
      <button
        type="button"
        aria-label={`${labels[locale]} — ${t("language")}`}
        title={t("language")}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        data-testid="language-switcher"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground uppercase transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        <span>{locale}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={t("language")}
          className="absolute top-full right-0 z-50 mt-2 min-w-36 rounded-xl border border-border bg-popover p-1.5"
        >
          {(Object.keys(labels) as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              data-locale-option={option}
              aria-selected={option === locale}
              onClick={() => changeLocale(option)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-popover-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{labels[option]}</span>
              <span className="ml-4 flex items-center gap-1.5 text-xs text-muted-foreground uppercase">
                {option === locale && <Check className="h-3.5 w-3.5 text-foreground" />}
                {option}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {pending ? (
        <span className="sr-only" role="status">
          {t("changingLanguage")}
        </span>
      ) : null}
    </div>
  );
}
