import type { Metadata } from "next";

import { PwBlogArchive } from "@/components/pw/blog-archive";
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
    <PwBlogArchive
      locale={locale}
      title={t("title")}
      description={t("listDescription")}
      posts={posts.map(toBlogCardData).map((post) => ({
        slug: post.slug,
        title: post.title,
        dateLabel: post.dateLabel,
        category: post.category ?? null,
      }))}
      emptyTitle={t("empty.title")}
      emptyDescription={t("empty.description")}
    />
  );
}
