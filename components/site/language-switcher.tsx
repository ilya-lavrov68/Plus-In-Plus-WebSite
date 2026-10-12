"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { localizedPath, localeFromPath, type Locale } from "@/i18n";

const labels: Record<Locale, string> = { en: "English", ru: "Русский" };

export function LanguageSwitcher() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const locale = localeFromPath(pathname);

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
      // Navigation still works when storage is disabled.
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
        aria-label={`${labels[locale]} language`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center rounded-sm border-b border-navy px-1 pb-0.5 font-body text-sm font-medium leading-none text-navy transition-colors duration-200 ease-out hover:text-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        Aa
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full z-50 mt-3 min-w-32 rounded-xl border border-[#052B42]/10 bg-white p-1.5 shadow-lg"
        >
          {(Object.keys(labels) as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === locale}
              onClick={() => changeLocale(option)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-body text-sm text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
            >
              {labels[option]}
              <span className="ml-4 text-xs uppercase text-[#052B42]/55">{option}</span>
            </button>
          ))}
        </div>
      ) : null}
      {switching ? <span className="sr-only" role="status">Changing language…</span> : null}
    </div>
  );
}
