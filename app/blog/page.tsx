import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { getPublishedPosts } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Blog — Plus In Plus",
  description: "News, ideas and design materials from the Plus In Plus team.",
  path: "/blog",
});

const POST_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <>
      <InternalPageHeader title="BLOG" />

      <InternalPageContent labelledBy="blog-list-heading">
        <h2 id="blog-list-heading" className="sr-only">
          Blog posts
        </h2>
        {posts.length ? (
          <ul className="divide-y divide-[#052B42]/15">
            {posts.map((post) => (
              <li key={post.id} className="py-6 first:pt-0 last:pb-0 sm:py-8">
                <article>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h3 className="font-geist text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="rounded-sm underline-offset-4 transition-colors duration-200 ease-out hover:text-[#0A4366] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    {post.publishedAt ? (
                      <time dateTime={post.publishedAt.toISOString()} className="font-body text-sm text-[#052B42]/75">
                        {POST_DATE_FORMAT.format(post.publishedAt)} · {post.readTime}-minute read
                      </time>
                    ) : null}
                  </div>
                  {post.excerpt ? <p className="mt-3 max-w-5xl font-body text-base leading-relaxed">{post.excerpt}</p> : null}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Newspaper}
            title="The blog is empty"
            description="Our first article is coming soon."
          />
        )}
      </InternalPageContent>
    </>
  );
}
