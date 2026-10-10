import { ArrowLeft, ArrowRight, Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import { SafeImage } from "@/components/site/safe-image";
import { getPublishedPost, getPublishedPosts, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { sanitizePostContent } from "@/lib/sanitize-post-content";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  const title = post ? `${post.title} — Plus In Plus` : "Новости и статьи — Plus In Plus";

  return createPageMetadata({
    title,
    description:
      post?.excerpt ?? "Новости, идеи и материалы о дизайне от команды Plus In Plus.",
    path: `/blog/${encodeURIComponent(slug)}`,
    image: post?.coverImage,
    type: "article",
    publishedTime: post?.publishedAt,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) redirect("/blog");

  const otherPosts = (await getPublishedPosts()).filter((item) => item.slug !== post.slug);
  const newsItems = otherPosts.map(toNewsItem);
  const meta = [
    post.publishedAt ? DATE_FORMAT.format(post.publishedAt) : null,
    `${post.readTime}-minute read`,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <>
      <article className="text-[#052B42] mx-auto max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
        <header>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
          {meta && <p className="mt-4 text-[#052B42]">{meta}</p>}
        </header>

        {post.coverImage && (
          <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-lg">
            <SafeImage
              src={post.coverImage}
              alt=""
              fill
              priority
              sizes="(min-width: 896px) 896px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div
          className="article-content mt-8"
          dangerouslySetInnerHTML={{ __html: sanitizePostContent(post.content) }}
        />

        {/* Prev/next post navigation — placeholders until more posts exist. */}
        <nav
          aria-label="Post navigation"
          className="mt-14 flex items-center justify-between gap-4"
        >
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-sm text-lg font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            Previous
          </Link>
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-sm text-lg font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Next
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </nav>
      </article>

      <section aria-labelledby="post-other-news" className="bg-[#D6E4FF] text-[#052B42]">
        <div className="text-[#052B42] mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <h2
            id="post-other-news"
            className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Other News
          </h2>
          <div className="mt-10 sm:mt-12">
            {newsItems.length ? (
              <NewsCarousel items={newsItems} label="Other news" />
            ) : (
              <EmptyState
                icon={Newspaper}
                title="No news yet"
                description="Check back later for updates."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
