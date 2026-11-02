import Link from "next/link";

/**
 * Секции главной в композиции payloadcms.com (MIT): hero 4/8 колонок,
 * лента логотипов, сплит с медиа, 4 сценария в 2 колонки, цитата,
 * фичи с панелями, манифест с тремя CTA.
 */

export interface PlLink {
  label: string;
  href: string;
}

const localeHref = (locale: string, href: string) => `/${locale}${href === "/" ? "" : href}`;

function MediaPanel({
  label,
  title,
  meta,
  className = "",
}: {
  label: string;
  title: string;
  meta: string;
  className?: string;
}) {
  return (
    <div className={`pl-media ${className}`}>
      <div className="flex h-full flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <span className="pl-mono text-[10px] text-[var(--pl-muted)]">{label}</span>
          <span aria-hidden="true" className="block h-2 w-2 bg-[var(--pl-accent)]" />
        </div>
        <div>
          <p className="text-[15px] leading-snug font-medium tracking-[-0.01em]">{title}</p>
          <p className="pl-mono mt-3 text-[10px] text-[var(--pl-muted)]">{meta}</p>
        </div>
      </div>
    </div>
  );
}

export function PlHero({
  locale,
  announcement,
  eyebrow,
  title,
  description,
  primary,
  secondary,
  note,
  panels,
  logoLabel,
  logos,
}: {
  locale: string;
  announcement: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  primary: PlLink;
  secondary: PlLink;
  note: string;
  panels: { label: string; title: string; meta: string }[];
  logoLabel: string;
  logos: string[];
}) {
  return (
    <section className="relative border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)]">
        <div className="grid items-center gap-10 py-14 lg:grid-cols-12 lg:gap-12 lg:py-20">
          <div className="lg:col-span-5">
            <Link
              href={localeHref(locale, primary.href)}
              className="inline-flex items-center gap-2 border border-[var(--pl-border)] px-3 py-1.5 text-[13px] text-[var(--pl-text)]/85 transition-colors hover:border-[var(--pl-accent)] hover:text-[var(--pl-accent)]"
            >
              <span aria-hidden="true" className="block h-1.5 w-1.5 bg-[var(--pl-accent)]" />
              {announcement}
              <span aria-hidden="true">→</span>
            </Link>

            <p className="pl-mono mt-8 text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
            <h1 className="pl-h1 mt-4 max-w-[16ch]">{title}</h1>
            <p className="pl-body mt-6 max-w-[46ch]">{description}</p>

            <div className="mt-9 flex flex-col gap-2">
              <Link href={localeHref(locale, primary.href)} className="pl-btn pl-btn--accent">
                {primary.label}
                <span aria-hidden="true">→</span>
              </Link>
              <Link href={localeHref(locale, secondary.href)} className="pl-btn">
                {secondary.label}
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <p className="pl-mono mt-6 text-[10px] text-[var(--pl-muted)]">{note}</p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-2 sm:grid-cols-2">
              <MediaPanel {...panels[0]} className="min-h-[220px] sm:min-h-[300px]" />
              <div className="grid gap-2">
                <MediaPanel {...panels[1]} className="min-h-[140px]" />
                <MediaPanel {...panels[2]} className="min-h-[140px]" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--pl-border)] py-8">
          <p className="pl-small mx-auto max-w-xl text-center text-[15px]">{logoLabel}</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {logos.map((logo) => (
              <li key={logo} className="pl-mono text-[11px] text-[var(--pl-text)]/70">
                {logo}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PlSplit({
  locale,
  eyebrow,
  headingMuted,
  headingStrong,
  body,
  bullets,
  link,
  panels,
}: {
  locale: string;
  eyebrow: string;
  headingMuted: string;
  headingStrong: string;
  body: string;
  bullets: string[];
  link: PlLink;
  panels: { label: string; title: string; meta: string }[];
}) {
  return (
    <section className="border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="pl-mono text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
            <h2 className="pl-h2 mt-5">
              <span className="text-[var(--pl-muted)]">{headingMuted} </span>
              {headingStrong}
            </h2>
            <p className="pl-body mt-6 max-w-[44ch]">{body}</p>
            <ul className="mt-8">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start justify-between gap-6 border-t border-[var(--pl-border)] py-4 text-[16px]"
                >
                  {bullet}
                  <span aria-hidden="true" className="text-[var(--pl-accent)]">
                    ●
                  </span>
                </li>
              ))}
            </ul>
            <Link href={localeHref(locale, link.href)} className="pl-link mt-8 inline-block text-[15px]">
              {link.label}
            </Link>
          </div>
          <div className="lg:col-span-7">
            <div className="grid gap-2 sm:grid-cols-2">
              <MediaPanel {...panels[0]} className="min-h-[220px]" />
              <div className="grid gap-2">
                <MediaPanel {...panels[1]} className="min-h-[180px]" />
                <MediaPanel {...panels[2]} className="min-h-[180px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlCases({
  locale,
  eyebrow,
  heading,
  items,
  cta,
}: {
  locale: string;
  eyebrow: string;
  heading: string;
  items: { category: string; title: string; body: string; href: string; meta: string }[];
  cta: PlLink;
}) {
  return (
    <section className="border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="pl-mono text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
            <h2 className="pl-h2 mt-4 max-w-[24ch]">{heading}</h2>
          </div>
          <Link href={localeHref(locale, cta.href)} className="pl-btn max-w-[260px]">
            {cta.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-12 grid border-t border-[var(--pl-border)] md:grid-cols-2">
          {items.map((item, index) => (
            <article
              key={item.title}
              className="flex flex-col justify-between gap-8 border-b border-[var(--pl-border)] py-8 md:px-8 md:odd:border-r md:first:pl-0"
            >
              <div className="flex items-center justify-between">
                <span className="pl-mono text-[10px] text-[var(--pl-muted)]">{item.category}</span>
                <span className="pl-mono text-[10px] text-[var(--pl-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="pl-h4">
                  <Link className="pl-link" href={localeHref(locale, item.href)}>
                    {item.title}
                  </Link>
                </h3>
                <p className="pl-small mt-3 max-w-[42ch]">{item.body}</p>
              </div>
              <MediaPanel label={item.category} title={item.title} meta={item.meta} className="min-h-[150px]" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlStatement({
  quote,
  author,
  role,
  eyebrow,
}: {
  eyebrow: string;
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <section className="border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
        <p className="pl-mono text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
        <figure className="mt-8 grid gap-8 lg:grid-cols-12">
          <blockquote className="pl-h3 lg:col-span-9">
            «{quote}»
          </blockquote>
          <figcaption className="pl-small self-end lg:col-span-3">
            <span className="block text-[15px] text-[var(--pl-text)]">{author}</span>
            {role}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function PlFeatures({
  eyebrow,
  heading,
  items,
}: {
  eyebrow: string;
  heading: string;
  items: { title: string; body: string; panel: string }[];
}) {
  return (
    <section className="border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
        <p className="pl-mono text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
        <h2 className="pl-h2 mt-4 max-w-[26ch]">{heading}</h2>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.title} className="border-t border-[var(--pl-border)] pt-6">
              <MediaPanel label="Plus In Plus" title={item.panel} meta="Lumi Q1 · Kairo" className="min-h-[190px]" />
              <h3 className="pl-h5 mt-6">{item.title}</h3>
              <p className="pl-small mt-3 max-w-[46ch]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlManifesto({
  eyebrow,
  heading,
  paragraphs,
  links,
  cta,
}: {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  links: PlLink[];
  cta: PlLink;
}) {
  return (
    <section className="border-b border-[var(--pl-border)]">
      <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="pl-mono text-[11px] text-[var(--pl-muted)]">{eyebrow}</p>
            <h2 className="pl-h2 mt-4">{heading}</h2>
          </div>
          <div className="lg:col-span-6">
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="pl-body mt-5 first:mt-0">
                {paragraph}
              </p>
            ))}
            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <Link href={cta.href} className="pl-btn pl-btn--accent sm:max-w-[240px]">
                {cta.label}
                <span aria-hidden="true">→</span>
              </Link>
              <ul className="flex items-center gap-6 px-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="pl-link text-[15px]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
