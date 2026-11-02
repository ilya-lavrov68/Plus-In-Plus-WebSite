import Link from "next/link";

import logo from "./hero/logo-showcase.module.scss";
import classes from "./hero/hero.module.scss";

export interface PwHeroProps {
  locale: string;
  announcement: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  note: string;
  panels: { label: string; title: string; meta: string }[];
  logoLabel: string;
  logos: string[];
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * Hero, перенесённый из payloadcms/website (components/Hero/HomeNew, MIT):
 * их SCSS-модуль и их сетка 4/8 колонок, объявление сверху, две кнопки
 * на всю ширину, медиа-стек справа и лента логотипов под ним.
 */
export function PwHero({
  locale,
  announcement,
  eyebrow,
  title,
  accent,
  description,
  primary,
  secondary,
  note,
  panels,
  logoLabel,
  logos,
}: PwHeroProps) {
  return (
    <section className={classes.heroWrapper}>
      <div
        className={`${classes.heroContentWrapper} grid`}
        style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}
      >
        <div className={`cols-4 cols-m-8 ${classes.heroContent}`}>
          <div className={classes.announcementLink}>
            <Link href={href(locale, primary.href)}>{announcement}</Link>
          </div>

          <div className={classes.heroText}>
            <p className="pl-h6">{eyebrow}</p>
            <h1>
              {title} <span>{accent}</span>
            </h1>
            <p>{description}</p>
          </div>

          <ul className={classes.primaryButtons}>
            <li>
              <Link className="pl-btn" href={href(locale, primary.href)}>
                {primary.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link className="pl-btn" href={href(locale, secondary.href)}>
                {secondary.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>

          <p className="pl-h6">{note}</p>
        </div>

        <div className={`cols-8 start-8 start-m-1 ${classes.graphicWrapper}`}>
          <div className={logo.logoGrid}>
            {panels.map((panel) => (
              <div key={panel.title} className="pl-media" style={{ minHeight: "180px" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: "1.25rem" }}>
                  <span className="pl-mono">{panel.label}</span>
                  <div>
                    <p>{panel.title}</p>
                    <span className="pl-mono">{panel.meta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`${classes.logoShowcaseWrapper} grid`}
        style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}
      >
        <h6>{logoLabel}</h6>
        <ul className={logo.logoGrid}>
          {logos.map((item) => (
            <li key={item} className={logo.logoItem}>
              <span className="pl-small">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
