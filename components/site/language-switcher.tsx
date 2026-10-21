"use client";

import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { localizedPath, localeFromPath, type Locale } from "@/i18n";

const labels: Record<Locale, string> = { en: "English", ru: "Русский" };

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const activeLocale = useLocale();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const locale = localeFromPath(pathname) || activeLocale;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      setOpen(false);
      return;
    }

    try {
      window.localStorage.setItem("pip-locale", nextLocale);
      document.cookie = `pip-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.dataset.localeTransition = "true";
    } catch {
      // Storage disabled fallback
    }

    setOpen(false);
    setSwitching(true);
    window.setTimeout(() => {
      window.location.assign(localizedPath(pathname, nextLocale));
      window.setTimeout(() => {
        document.documentElement.removeAttribute("data-locale-transition");
        setSwitching(false);
      }, 220);
    }, 140);
  };

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        aria-label={`${labels[locale]} — ${t("language")}`}
        title={t("language")}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-out hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={t("language")}
          className="absolute top-full right-0 z-50 mt-2 min-w-32 rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          {(Object.keys(labels) as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === locale}
              onClick={() => changeLocale(option)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-popover-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels[option]}
              <span className="ml-4 text-xs text-muted-foreground uppercase">
                {option}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {switching ? (
        <span className="sr-only" role="status">
          {t("changingLanguage")}
        </span>
      ) : null}
    </div>
  );
}
