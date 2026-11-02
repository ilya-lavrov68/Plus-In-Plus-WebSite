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
  links: {
    label: string;
    href: string;
    children?: { label: string; href: string; description: string }[];
  }[];
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
                  <li
                    key={link.href}
                    className={desktop.dropdownWrap}
                    onMouseEnter={() => setOpenDropdown(link.children ? link.href : null)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <Link
                      href={href(locale, link.href)}
                      className={`${desktop.tab} ${openDropdown === link.href ? desktop.active : ""}`}
                      aria-expanded={link.children ? openDropdown === link.href : undefined}
                      onFocus={() => setOpenDropdown(link.children ? link.href : null)}
                    >
                      {link.label}
                      {link.children ? <span aria-hidden="true"> ▾</span> : null}
                    </Link>
                    {link.children ? (
                      <div className={`${desktop.dropdown} ${openDropdown === link.href ? desktop.show : ""}`}>
                        <div className={desktop.background} style={{ height: "100%" }} aria-hidden="true" />
                        <div className="grid">
                          {link.children.map((child) => (
                            <div
                              key={child.href}
                              className={`cols-4 ${desktop.dropdownItem} ${openDropdown === link.href ? desktop.show : ""}`}
                            >
                              <Link
                                href={href(locale, child.href)}
                                className={desktop.descriptionLink}
                                onClick={() => setOpenDropdown(null)}
                              >
                                <span className={desktop.listLabel}>{child.label}</span>
                                <span className={desktop.description}>{child.description}</span>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
              {[...links.flatMap((link) => [link, ...(link.children ?? [])]), ...utility].map((link) => (
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
