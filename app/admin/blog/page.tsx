import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";

import { PostsTable } from "@/components/admin/posts-table";
import { ImportSource } from "@/components/admin/import-source";
import { EmptyState } from "@/components/site/empty-state";
import { getAllPosts } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await getAllPosts();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
          <p className="mt-2 text-muted-foreground">
            Covers in /public/uploads/blog/, album images in /public/uploads/blog/albums/.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-200 ease-out hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:h-4 [&_svg]:w-4"
          aria-label="Create post"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          New post
        </Link>
      </div>

      <ImportSource />

      {posts.length ? (
        <PostsTable posts={posts} />
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Newspaper}
            title="No posts yet"
            description="Create the first blog post to see it here."
          />
        </div>
      )}
    </div>
  );
}
