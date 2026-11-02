import Link from "next/link";

import {
  PlCases,
  PlFeatures,
  PlHero,
  PlManifesto,
  PlSplit,
  PlStatement,
  type PlLink,
} from "@/components/payload/home-sections";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

interface Panel {
  label: string;
  title: string;
  meta: string;
}

interface HomeContent {
  announcement: string;
  eyebrow: string;
  description: string;
  primary: string;
  secondary: string;
  note: string;
  logoLabel: string;
  logos: string[];
  panels: Panel[];
  split: {
    eyebrow: string;
    muted: string;
    strong: string;
    body: string;
    bullets: string[];
    link: string;
  };
  cases: {
    eyebrow: string;
    heading: string;
    items: { category: string; title: string; body: string; href: string; meta: string }[];
    cta: string;
  };
  statement: { eyebrow: string; quote: string; author: string; role: string };
  features: {
    eyebrow: string;
    heading: string;
    items: { title: string; body: string; panel: string }[];
  };
  manifesto: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    links: PlLink[];
  };
}

const localized = (locale: string, href: string) => `/${locale}${href === "/" ? "" : href}`;

export default async function HomePage() {
  const [dbPosts, locale, t, tShell, tBlog] = await Promise.all([
    getPublishedPosts(3),
    getRequestLocale(),
    getRequestTranslations("home"),
    getRequestTranslations("shell"),
    getRequestTranslations("blog"),
  ]);

  const content = t.raw("pl") as HomeContent;
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), tBlog, locale).slice(0, 3);

  return (
    <>
      <PlHero
        locale={locale}
        announcement={content.announcement}
        eyebrow={content.eyebrow}
        title={
          <>
            {t("heroMuted")} {t("heroPrimary")}{" "}
            <span className="text-[var(--pl-accent)]">{t("heroAccent")}</span>
          </>
        }
        description={content.description}
        primary={{ label: content.primary, href: "/contact" }}
        secondary={{ label: content.secondary, href: "/services" }}
        note={content.note}
        panels={content.panels}
        logoLabel={content.logoLabel}
        logos={content.logos}
      />

      <PlSplit
        locale={locale}
        eyebrow={content.split.eyebrow}
        headingMuted={content.split.muted}
        headingStrong={content.split.strong}
        body={content.split.body}
        bullets={content.split.bullets}
        link={{ label: content.split.link, href: "/story" }}
        panels={content.panels}
      />

      <PlCases
        locale={locale}
        eyebrow={content.cases.eyebrow}
        heading={content.cases.heading}
        items={content.cases.items}
        cta={{ label: content.cases.cta, href: "/contact" }}
      />

      <PlStatement
        eyebrow={content.statement.eyebrow}
        quote={content.statement.quote}
        author={content.statement.author}
        role={content.statement.role}
      />

      <PlFeatures
        eyebrow={content.features.eyebrow}
        heading={content.features.heading}
        items={content.features.items}
      />

      {posts.length > 0 ? (
        <section className="border-b border-[var(--pl-border)]">
          <div className="px-[var(--pl-gutter)] py-[var(--pl-block)]">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="pl-mono text-[11px] text-[var(--pl-muted)]">Блог</p>
                <h2 className="pl-h2 mt-4">{t("newsTitle")}</h2>
              </div>
              <Link href={localized(locale, "/blog")} className="pl-link text-[15px]">
                {tShell("blog")}
              </Link>
            </div>
            <ul className="mt-10 border-t border-[var(--pl-border)]">
              {posts.map((post) => (
                <li key={post.slug} className="border-b border-[var(--pl-border)]">
                  <Link
                    href={localized(locale, `/blog/${post.slug}`)}
                    className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:justify-between"
                  >
                    <span className="text-[18px] tracking-[-0.01em]">{post.title}</span>
                    <span className="pl-mono text-[10px] text-[var(--pl-muted)]">
                      {post.category ?? "Studio"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <PlManifesto
        eyebrow={content.manifesto.eyebrow}
        heading={content.manifesto.heading}
        paragraphs={content.manifesto.paragraphs}
        links={content.manifesto.links.map((link) => ({
          label: link.label,
          href: localized(locale, link.href),
        }))}
        cta={{ label: content.secondary, href: localized(locale, "/services") }}
      />
    </>
  );
}
