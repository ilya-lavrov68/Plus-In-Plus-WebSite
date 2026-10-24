import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";
import BlogPostContent from "./content";

export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [dbPosts, locale, t] = await Promise.all([
    getPublishedPosts(),
    getRequestLocale(),
    getRequestTranslations("blog"),
  ]);
  const allPosts = localizeBlogPosts(mergeCatalogPosts(dbPosts), t, locale);
  const post = allPosts.find((item) => item.slug === slug);
  if (!post) notFound();

  return createPageMetadata({
    title: `${post.title} — Plus In Plus`,
    description: post.excerpt,
    path: `/blog/${encodeURIComponent(slug)}`,
    image: post.image,
    type: "article",
    locale,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  // Keep existence checks ahead of any loading/Suspense boundary. Otherwise
  // Next.js streams a 200 shell before the missing article can return a 404.
  return BlogPostContent({ slug });
}
