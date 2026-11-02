import {
  DirectionMarquee,
  Manifesto,
  Process,
  SplitDirections,
  UseCases,
} from "@/components/blocks/home-sections";
import { BlogSection } from "@/components/site/blog-section";
import { CtaSection } from "@/components/site/cta-section";
import { Hero } from "@/components/site/hero";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [dbPosts, locale, t, tBlog] = await Promise.all([
    getPublishedPosts(3),
    getRequestLocale(),
    getRequestTranslations("home"),
    getRequestTranslations("blog"),
  ]);
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), tBlog, locale).slice(0, 3);

  return (
    <>
      <Hero />

      <DirectionMarquee
        items={[
          t("marquee1"),
          t("marquee2"),
          t("marquee3"),
          t("marquee4"),
          t("marquee5"),
          t("marquee6"),
        ]}
      />

      <SplitDirections
        eyebrow={t("split.eyebrow")}
        heading={t("split.heading")}
        columns={[
          {
            index: "01",
            title: t("split.designTitle"),
            body: t("split.designBody"),
            bullets: [
              t("split.designBullet1"),
              t("split.designBullet2"),
              t("split.designBullet3"),
            ],
            href: "/services",
            linkLabel: t("split.designLink"),
          },
          {
            index: "02",
            title: t("split.aiTitle"),
            body: t("split.aiBody"),
            bullets: [
              t("split.aiBullet1"),
              t("split.aiBullet2"),
              t("split.aiBullet3"),
            ],
            href: "/ai",
            linkLabel: t("split.aiLink"),
          },
        ]}
      />

      <UseCases
        eyebrow={t("cases.eyebrow")}
        heading={t("cases.heading")}
        description={t("cases.description")}
        cards={[
          {
            index: "01",
            title: t("cases.oneTitle"),
            body: t("cases.oneBody"),
            href: "/services",
          },
          {
            index: "02",
            title: t("cases.twoTitle"),
            body: t("cases.twoBody"),
            href: "/services",
          },
          {
            index: "03",
            title: t("cases.threeTitle"),
            body: t("cases.threeBody"),
            href: "/ai",
          },
          {
            index: "04",
            title: t("cases.fourTitle"),
            body: t("cases.fourBody"),
            href: "/shop",
          },
        ]}
      />

      <Process
        eyebrow={t("process.eyebrow")}
        heading={t("process.heading")}
        steps={[
          { index: "01", title: t("process.oneTitle"), body: t("process.oneBody") },
          { index: "02", title: t("process.twoTitle"), body: t("process.twoBody") },
          { index: "03", title: t("process.threeTitle"), body: t("process.threeBody") },
          { index: "04", title: t("process.fourTitle"), body: t("process.fourBody") },
        ]}
      />

      <Manifesto
        eyebrow={t("manifesto.eyebrow")}
        heading={t("manifesto.heading")}
        paragraphs={[t("manifesto.p1"), t("manifesto.p2")]}
        linkLabel={t("manifesto.link")}
        href="/contact"
      />

      <BlogSection
        id="news"
        heading={t("newsTitle")}
        description={t("newsDescription")}
        posts={posts}
        allCategoryLabel={tBlog("allCategory")}
        categoryLabels={{
          Design: tBlog("categoryDesign"),
          Studio: tBlog("categoryStudio"),
          Outdoor: tBlog("categoryOutdoor"),
        }}
        emptyTitle={tBlog("empty.title")}
        emptyDescription={tBlog("empty.description")}
      />

      <CtaSection />
    </>
  );
}
