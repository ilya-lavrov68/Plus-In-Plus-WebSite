import Link from "next/link";

import block from "./block-wrapper.module.scss";
import classes from "./media-content.module.scss";

export interface PwMediaContentProps {
  locale: string;
  eyebrow: string;
  heading: string;
  body: string;
  bullets: string[];
  link: { label: string; href: string };
  media: { label: string; title: string; meta: string }[];
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * MediaContent из payloadcms/website: текст в левой колонке, медиа-коллаж
 * справа; классы и пропорции — из их SCSS-модуля.
 */
export function PwMediaContent({ locale, eyebrow, heading, body, bullets, link, media }: PwMediaContentProps) {
  return (
    <div
      className={block.blockWrapper}
      style={{ paddingTop: "var(--block-spacing)", paddingBottom: "var(--block-spacing)" }}
    >
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className={`cols-4 cols-m-8 ${classes.content}`}>
          <p className="pl-h6">{eyebrow}</p>
          <h2 className="pl-h3">{heading}</h2>
          <p>{body}</p>
          <ul>
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <Link className="pl-btn" href={href(locale, link.href)}>
            {link.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className={`cols-8 start-8 start-m-1 cols-m-8 ${classes.media}`}>
          <div className={`grid ${classes.stretchRight}`}>
            {media.map((item) => (
              <div key={item.title} className="cols-8 pl-media" style={{ minHeight: "180px" }}>
                <div style={{ padding: "1.25rem" }}>
                  <span className="pl-h6">{item.label}</span>
                  <p>{item.title}</p>
                  <span className="pl-h6">{item.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
