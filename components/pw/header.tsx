"use client";

import Link from "next/link";
import { useState } from "react";

import classes from "./header/header.module.scss";
import desktop from "./header/desktop.module.scss";
import mobile from "./header/mobile.module.scss";

export interface PwHeaderProps {
  locale: "ru" | "en";
  topBar: string;
  menuLabel: string;
  closeLabel: string;
  links: { label: string; href: string }[];
  utility: { label: string; href: string }[];
  cta: { label: string; href: string };
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * Шапка из payloadcms/website (components/Header, DesktopNav, MobileNav — MIT):
 * их SCSS-модули, их верхняя строка, панель навигации и мобильное меню.
 */
export function PwHeader({ locale, topBar, menuLabel, closeLabel, links, utility, cta }: PwHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={classes.wrapper}>
      <div className={classes.topBar} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="pl-h6">{topBar}</span>
      </div>

      <header className={`${classes.header} ${open ? classes.mobileNavOpen : ""}`}>
        <div className={desktop.desktopNav}>
          <div
            className={`${desktop.container} grid`}
            style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)", alignItems: "center", height: "100%" }}
          >
            <Link href={href(locale, "/")} className={`cols-3 ${desktop.logo}`}>
              Plus In Plus
            </Link>

            <nav className={`cols-8 ${desktop.tabs}`} aria-label="Main">
              <ul style={{ display: "flex", alignItems: "center", gap: "1.5rem", listStyle: "none", margin: 0, padding: 0 }}>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={href(locale, link.href)} className={desktop.tab}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={`cols-5 ${desktop.secondaryNavItems}`}>
              {utility.map((item) => (
                <Link
                  key={item.href}
                  href={href(locale, item.href)}
                  className={desktop.defaultLink}
                >
                  {item.label}
                </Link>
              ))}
              <Link href={href(locale, cta.href)} className={desktop.button}>
                {cta.label}
              </Link>
              <button
                type="button"
                className={`${desktop.tab} ${desktop.link} lg:hidden`}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={open ? closeLabel : menuLabel}
              >
                <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                  {open ? (
                    <path d="M2 2l14 8M16 2L2 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  ) : (
                    <path d="M0 1h18M0 6h18M0 11h18" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {open ? (
          <nav className={`${mobile.mobileNav} ${mobile.hamburgerOpen}`} aria-label="Mobile">
            <ul className={mobile.linkWrap}>
              {[...links, ...utility].map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link href={href(locale, link.href)} className={mobile.link} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={href(locale, cta.href)} className={mobile.link} onClick={() => setOpen(false)}>
              {cta.label}
            </Link>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
