import Link from "next/link";

import block from "./block-wrapper.module.scss";
import classes from "./card-grid.module.scss";
import card from "./square-card.module.scss";

export interface PwCardGridProps {
  locale: string;
  eyebrow: string;
  heading: string;
  cta: { label: string; href: string };
  cards: { category: string; title: string; body: string; meta: string; href: string }[];
}

const href = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * Блок CardGrid из payloadcms/website: их SCSS-модули BlockWrapper,
 * CardGrid и SquareCard и их разметка (intro-колонка + сетка карточек).
 */
export function PwCardGrid({ locale, eyebrow, heading, cta, cards }: PwCardGridProps) {
  return (
    <div
      className={`${block.blockWrapper} ${classes.cardGrid}`}
      style={{ paddingTop: "var(--block-spacing)", paddingBottom: "var(--block-spacing)" }}
    >
      <div
        className="grid"
        style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}
      >
        <div className={`cols-4 cols-m-8 ${classes.introWrapper}`}>
          <p className="pl-h6">{eyebrow}</p>
          <h2 className="pl-h3">{heading}</h2>
          <Link className="pl-btn" href={href(locale, cta.href)}>
            {cta.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className={`cols-12 cols-m-8 ${classes.cardsWrapper}`}>
          <div className={`grid ${classes.cards}`}>
            {cards.map((item) => (
              <article key={item.title} className={`cols-6 cols-m-4 ${card.card}`}>
                <Link className={card.titleWrapper} href={href(locale, item.href)}>
                  <h3 className={card.title}>{item.title}</h3>
                </Link>
                <div className={card.descriptionWrapper}>
                  <p>{item.body}</p>
                  <span className="pl-h6">{item.meta}</span>
                </div>
                <span className={card.leader}>{item.category}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
