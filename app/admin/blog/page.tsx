import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/site/empty-state";
import { SafeImage } from "@/components/site/safe-image";
import { deletePost } from "@/app/actions/posts";
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
            Covers are stored in /public/uploads/blog/.
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

      {posts.length ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Read time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="relative h-12 w-16 overflow-hidden rounded-md border border-border">
                      <SafeImage
                        src={post.coverImage}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {post.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={post.isPublished ? "default" : "outline"}>
                      {post.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>{post.readTime} min</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors duration-200 ease-out hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4"
                        aria-label={`Edit ${post.title}`}
                      >
                        Edit
                      </Link>
                      <DeleteButton label={post.title} id={post.id} onDelete={deletePost} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
