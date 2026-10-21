import type { Metadata } from "next";

import { Blog11 } from "@/components/blocks/blog11";
import { getPublishedPosts } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Blog — Plus In Plus",
    description:
      "News, studio updates, and design stories from Plus In Plus.",
    path: "/blog",
    locale,
  });
}

export default async function BlogPage() {
  const dbPosts = await getPublishedPosts();
  const posts = mergeCatalogPosts(dbPosts);

  return (
    <Blog11
      id="blog-page"
      heading="Blog"
      description="Updates from our design studio, product ecosystems, and client projects."
      posts={posts}
      asPageHeading
    />
  );
}
