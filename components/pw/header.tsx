"use client";

import Link from "next/link";
import { useState } from "react";

import { PwAvatar } from "./avatar";
import classes from "./header/header.module.scss";
import desktop from "./header/desktop.module.scss";
import topbar from "./header/topbar.module.scss";

export interface PwHeaderProps {
  locale: "ru" | "en";
  topBar: string;
  menuLabel: string;
  closeLabel: string;
  links: {
    label: string;
    href: string;
    description?: string;
    children?: { label: string; href: string; description: string }[];
  }[];
  utility: { label: string; href: string }[];
  cta: { label: string; href: string };
  user?: { name?: string | null; email?: string | null } | null;
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * Шапка payloadcms.com: верхняя строка TopBar (success-100), панель
 * DesktopNav высотой --header-height (логотип cols-4, контент cols-8,
 * утилиты cols-4) и выпадающие меню внутри .tabs.
 */
export function PwHeader({ locale, topBar, menuLabel, closeLabel, links, utility, cta, user }: PwHeaderProps) {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <div className={classes.wrapper}>
      <Link className={topbar.topBar} href={href(locale, cta.href)}>
        <span className={topbar.message}>{topBar}</span>
        <span className={topbar.label}>{cta.label}</span>
        <span aria-hidden="true">→</span>
      </Link>

      <header className={classes.header}>
        <div className={`pw-bar ${desktop.desktopNav}`} style={{ width: "100%" }}>
          <div
            className={`${desktop.desktopNav} ${openDropdown ? desktop.active : ""}`}
            style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}
          >
            <div className={`${desktop.grid} grid`}>
              <div className={`${desktop.logo} cols-4`}>
                <Link className={desktop.logo} href={href(locale, "/")}>
                  Plus In Plus
                </Link>
              </div>

              <div className={`${desktop.content} cols-8`} data-pw-nav="">
                <div className={desktop.tabs} onMouseLeave={() => setOpenDropdown(null)}>
                  {links.map((link) => (
                    <div
                      key={link.href}
                      onMouseEnter={() => setOpenDropdown(link.children ? link.href : null)}
                    >
                      {link.children ? (
                        <button
                          type="button"
                          className={desktop.tab}
                          aria-expanded={openDropdown === link.href}
                          onClick={() => setOpenDropdown(openDropdown === link.href ? null : link.href)}
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link className={`${desktop.tab} ${desktop.directLink}`} href={href(locale, link.href)}>
                          {link.label}
                        </Link>
                      )}

                      {link.children && openDropdown === link.href ? (
                        <div
                          className={`grid ${desktop.dropdown} ${desktop.activeTab}`}
                          style={{ top: "calc(var(--top-bar-height) + var(--header-height))" }}
                        >
                          <div className={`${desktop.description} cols-4`}>
                            {link.description ?? link.label}
                          </div>
                          {link.children.map((child) => (
                            <div key={child.href} className={`cols-4 ${desktop.dropdownItem}`}>
                              <Link className={desktop.defaultLink} href={href(locale, child.href)}>
                                <div className={desktop.defaultLinkLabel}>{child.label}</div>
                                <div className={desktop.defaultLinkDescription}>
                                  {child.description}
                                  <span aria-hidden="true" className={desktop.linkArrow}>
                                    →
                                  </span>
                                </div>
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="cols-4">
                <div className={`${desktop.secondaryNavItems} ${desktop.show}`}>
                  {user ? (
                    <PwAvatar name={user.name} email={user.email} href={href(locale, "/profile")} />
                  ) : null}
                  <span className="pw-header-utility">
                    {utility.map((item) => (
                      <Link key={item.href} className={desktop.defaultLink} href={href(locale, item.href)}>
                        {item.label}
                      </Link>
                    ))}
                    <Link className={desktop.button} href={href(locale, cta.href)}>
                      {cta.label}
                    </Link>
                  </span>
                  <button
                    type="button"
                    className={`${desktop.tab} pw-burger`}
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    aria-label={open ? closeLabel : menuLabel}
                    style={{ height: "auto" }}
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
          </div>
        </div>

        {open ? (
          <nav className="pw-mobile-nav" aria-label="Mobile">
            <ul>
              {[...links.flatMap((link) => [link, ...(link.children ?? [])]), ...utility].map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link className="pw-mobile-link" href={href(locale, link.href)} onClick={() => setOpen(false)}>
                    {link.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="pl-btn" href={href(locale, cta.href)} onClick={() => setOpen(false)}>
              {cta.label}
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
