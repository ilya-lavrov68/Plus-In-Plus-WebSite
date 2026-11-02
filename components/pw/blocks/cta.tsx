import Link from "next/link";

import block from "./block-wrapper.module.scss";
import classes from "./cta.module.scss";

export interface PwCtaProps {
  locale: string;
  heading: string;
  body: string;
  primary: { label: string; href: string };
  links: { label: string; href: string }[];
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/** CallToAction из payloadcms/website: контейнер, контент и ряд ссылок. */
export function PwCta({ locale, heading, body, primary, links }: PwCtaProps) {
  return (
    <div
      className={block.blockWrapper}
      style={{ paddingTop: "var(--block-spacing)", paddingBottom: "var(--block-spacing)" }}
    >
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className={`cols-6 cols-m-8 ${classes.container}`}>
          <div className={classes.contentWrapper}>
            <h2 className="pl-h2">{heading}</h2>
            <p>{body}</p>
          </div>
        </div>
        <div className={`cols-6 cols-m-8 ${classes.linksContainer}`}>
          <div className={classes.links}>
            <Link className="pl-btn" href={href(locale, primary.href)}>
              {primary.label}
              <span aria-hidden="true">→</span>
            </Link>
            {links.map((link) => (
              <Link key={link.href} href={href(locale, link.href)} className={classes.bannerLink}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
