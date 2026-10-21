import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Blog11 } from "@/components/blocks/blog11";
import { Blogpost11 } from "@/components/blocks/blogpost11";
import { getPublishedPosts } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [dbPosts, locale] = await Promise.all([
    getPublishedPosts(),
    getRequestLocale(),
  ]);
  const allPosts = mergeCatalogPosts(dbPosts);
  const post = allPosts.find((item) => item.slug === slug);

  return createPageMetadata({
    title: post ? `${post.title} — Plus In Plus` : "Blog — Plus In Plus",
    description:
      post?.excerpt ||
      "Studio updates, product stories, and insights from Plus In Plus.",
    path: `/blog/${encodeURIComponent(slug)}`,
    image: post?.image,
    type: "article",
    locale,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const dbPosts = await getPublishedPosts();
  const allPosts = mergeCatalogPosts(dbPosts);

  const index = allPosts.findIndex((item) => item.slug === slug);
  if (index === -1) {
    redirect("/blog");
  }

  const post = allPosts[index];
  const previousPost =
    index < allPosts.length - 1 ? allPosts[index + 1] : null;
  const nextPost = index > 0 ? allPosts[index - 1] : null;
  const otherPosts = allPosts.filter((item) => item.slug !== post.slug);

  return (
    <>
      <Blogpost11
        post={post}
        previousPost={previousPost}
        nextPost={nextPost}
      />
      <Blog11
        id="post-other-news"
        heading="Other News"
        description="Explore more articles and stories from the Plus In Plus team."
        posts={otherPosts.length > 0 ? otherPosts : allPosts}
      />
    </>
  );
}
