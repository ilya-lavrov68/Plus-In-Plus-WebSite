import type { Metadata } from "next";

import { Blog11 } from "@/components/blocks/blog11";
import { getPublishedPosts } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { mergeCatalogPosts } from "@/lib/studio-catalog";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { toBlogCardData } from "@/lib/blog-card";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getRequestLocale(), getRequestTranslations("metadata")]);
  return createPageMetadata({
    title: t("blog"),
    description: t("blogDescription"),
    path: "/blog",
    locale,
  });
}

export default async function BlogPage() {
  const [dbPosts, locale, t] = await Promise.all([
    getPublishedPosts(),
    getRequestLocale(),
    getRequestTranslations("blog"),
  ]);
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), t, locale);

  return (
    <Blog11
      id="blog-page"
      heading={t("title")}
      description={t("listDescription")}
      posts={posts.map(toBlogCardData)}
      allCategoryLabel={t("allCategory")}
      categoryLabels={{ Design: t("categoryDesign"), Studio: t("categoryStudio"), Outdoor: t("categoryOutdoor") }}
      emptyTitle={t("empty.title")}
      emptyDescription={t("empty.description")}
      emptyEyebrow={t("empty.eyebrow")}
      eyebrow={t("eyebrow")}
      featuredLabel={t("featured")}
      readTimeTemplate={String(t.raw("readTime"))}
      readLabel={t("read")}
      ctaTitle={t("cta.title")}
      ctaDescription={t("cta.description")}
      ctaAction={t("cta.action")}
      asPageHeading
    />
  );
}
