import Link from "next/link";

import classes from "./footer/footer.module.scss";

export interface PwFooterProps {
  groups: { title: string; links: { label: string; href: string }[] }[];
  social: { label: string; href: string }[];
  contactEmail?: string;
  contactPhone?: string;
  legal: { label: string; href: string }[];
  locale: string;
}

/**
 * Футер, перенесённый из payloadcms/website (components/Footer, MIT):
 * их SCSS-модуль и их структура — 16-колоночная сетка, заголовки h6,
 * подписка, соцссылки и нижняя строка.
 */
export function PwFooter({ groups, social, contactEmail, contactPhone, legal, locale }: PwFooterProps) {
  const href = (path: string) => `/${locale}${path === "/" ? "" : path}`;

  return (
    <footer className={classes.footer}>
      <div className={classes.topBorder} aria-hidden="true" />
      <div
        className={classes.container}
        style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}
      >
        <div className={`grid ${classes.grid}`}>
          {groups.map((group) => (
            <div key={group.title} className="cols-3 cols-m-4">
              <p className={classes.colHeader}>{group.title}</p>
              <nav className={classes.colItems}>
                {group.links.map((link) => (
                  <Link key={`${group.title}-${link.label}`} href={href(link.href)} className="link">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}

          <div className="cols-4 cols-m-8">
            <p className={classes.colHeader}>Contact</p>
            <div className={classes.colItems}>
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="link">
                  {contactEmail}
                </a>
              ) : null}
              {contactPhone ? (
                <a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`} className="link">
                  {contactPhone}
                </a>
              ) : null}
            </div>
            <p className={classes.subscribeDesc}>Новости студии, раз в месяц.</p>
            <form className={classes.subscribeAction} action="/api/newsletter" method="post">
              <div className={classes.inputWrap}>
                <input
                  className={classes.emailInput}
                  type="email"
                  name="email"
                  required
                  placeholder="you@studio.ru"
                  aria-label="Email"
                />
                <button className={classes.submitButton} type="submit" aria-label="Подписаться">
                  →
                </button>
              </div>
            </form>
            <ul className={classes.socialLinks}>
              {social.map((item) => (
                <li key={item.href}>
                  <a
                    className={classes.socialIconLink}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="cols-16">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                marginTop: "3rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid var(--grid-line-dark)",
              }}
            >
              <span className={classes.colHeader} style={{ marginBottom: 0 }}>
                © 2026 Plus In Plus
              </span>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                {legal.map((item) => (
                  <Link key={item.href} href={href(item.href)} className="link">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
