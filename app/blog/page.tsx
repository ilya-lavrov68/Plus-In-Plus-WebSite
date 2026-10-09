import { Newspaper } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import { getPublishedPosts, toNewsItem } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Plus In Plus",
};

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Blog</h1>
      <div className="mt-10">
        {newsItems.length ? (
          <NewsCarousel items={newsItems} label="Blog" />
        ) : (
          <EmptyState
            icon={Newspaper}
            title="The blog is empty"
            description="Our first article is coming soon."
          />
        )}
      </div>
    </div>
  );
}
