import { ArrowLeft, ArrowRight, Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import { getPublishedPost, getPublishedPosts, toNewsItem } from "@/lib/data";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

interface BlogPostPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getPublishedPost(params.slug);
  return { title: post ? `${post.title} — Plus In Plus` : "Blog — Plus In Plus" };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getPublishedPost(params.slug);
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
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
        <header>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
          {meta && <p className="mt-4 text-muted-foreground">{meta}</p>}
        </header>

        {post.coverImage && (
          <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-lg">
            <Image
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
          dangerouslySetInnerHTML={{ __html: post.content }}
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

      <section aria-labelledby="post-other-news" className="bg-lavender">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
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
