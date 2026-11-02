"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface HeaderLink {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  links: HeaderLink[];
  utility: HeaderLink[];
  cta: HeaderLink;
  topBar: string;
  menuLabel: string;
  closeLabel: string;
  locale: "ru" | "en";
}

const withLocale = (locale: "ru" | "en", href: string) => `/${locale}${href === "/" ? "" : href}`;

/**
 * Шапка в геометрии payloadcms.com: верхняя строка-объявление 3rem,
 * фиксированная панель 90px (76/66 на планшете и телефоне), hairline снизу,
 * ссылки слева от центра, утилиты и CTA справа.
 */
export function SiteHeader({ links, utility, cta, topBar, menuLabel, closeLabel, locale }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  const stripped = pathname.replace(/^\/(ru|en)/, "") || "/";
  const other: "ru" | "en" = locale === "ru" ? "en" : "ru";

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="flex h-[var(--pl-topbar)] items-center justify-center border-b border-[var(--pl-border)] bg-[var(--pl-panel)] px-4 text-[var(--pl-text)]">
        <span className="pl-mono text-[11px] tracking-[0.18em]">{topBar}</span>
      </div>

      <header className="relative border-b border-white/10 bg-[var(--pl-bg)]">
        <div className="flex h-[var(--pl-header)] items-center gap-8 px-[var(--pl-gutter)]">
          <Link
            href={withLocale(locale, "/")}
            className="flex items-center gap-2 text-[var(--pl-text)]"
            aria-label="Plus In Plus"
          >
            <span className="text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap">
              Plus In Plus
            </span>
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={withLocale(locale, link.href)}
                    className="text-[15px] text-[var(--pl-text)]/85 transition-colors duration-150 hover:text-[var(--pl-text)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-5">
            <ul className="hidden items-center gap-4 md:flex">
              {utility.map((link) => (
                <li key={link.href}>
                  <Link
                    href={withLocale(locale, link.href)}
                    className="text-[13px] text-[var(--pl-muted)] transition-colors duration-150 hover:text-[var(--pl-text)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={`/${other}${stripped === "/" ? "" : stripped}`}
              className="pl-mono hidden text-[11px] text-[var(--pl-muted)] transition-colors hover:text-[var(--pl-text)] md:block"
            >
              {other.toUpperCase()}
            </Link>

            <Link
              href={withLocale(locale, cta.href)}
              className="hidden border border-[var(--pl-border-strong)] px-4 py-2 text-[14px] font-medium text-[var(--pl-text)] transition-colors duration-150 hover:text-[var(--pl-text)] sm:block"
            >
              {cta.label}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="pl-mobile-nav"
              className="flex h-10 w-10 items-center justify-center border border-[var(--pl-border)] text-[var(--pl-text)] lg:hidden"
            >
              <span className="sr-only">{open ? closeLabel : menuLabel}</span>
              <span aria-hidden="true" className="relative block h-3 w-4">
                <span
                  className={`absolute inset-x-0 top-0 h-px bg-current transition-transform duration-200 ${open ? "translate-y-1.5 rotate-45" : ""}`}
                />
                <span
                  className={`absolute inset-x-0 top-1.5 h-px bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
                />
                <span
                  className={`absolute inset-x-0 top-3 h-px bg-current transition-transform duration-200 ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div id="pl-mobile-nav" className="pl-drawer lg:hidden">
          <nav aria-label="Mobile" className="px-[var(--pl-gutter)] py-8">
            <ul>
              {[...links, ...utility].map((link) => (
                <li key={`${link.href}-${link.label}`} className="border-b border-white/10">
                  <Link
                    href={withLocale(locale, link.href)}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-5 text-[22px] tracking-[-0.02em]"
                  >
                    {link.label}
                    <span aria-hidden="true" className="text-[var(--pl-text)]">
                      ↗
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={withLocale(locale, cta.href)}
              onClick={() => setOpen(false)}
              className="pl-btn pl-btn--accent mt-8"
            >
              {cta.label}
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
