import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { getPublishedPosts, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Blog — Plus In Plus",
  description: "News, ideas and design materials from the Plus In Plus team.",
  path: "/blog",
});

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <InternalPageHeader title="BLOG" />

      <InternalPageContent labelledBy="blog-list-heading">
        <h2 id="blog-list-heading" className="sr-only">
          Blog posts
        </h2>
        {posts.length ? (
          // Placeholder list; will become a carousel later.
          <ul className="space-y-6">
            {posts.map((post) => (
              <li key={post.id} className="border-b border-[#052B42]/10 pb-6 last:border-b-0">
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-2xl font-semibold tracking-tight underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                >
                  {post.title}
                </Link>
                {post.excerpt && <p className="mt-2 text-base leading-relaxed">{post.excerpt}</p>}
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

      <OtherNewsSection items={newsItems} id="blog-other-news" />
    </>
  );
}
