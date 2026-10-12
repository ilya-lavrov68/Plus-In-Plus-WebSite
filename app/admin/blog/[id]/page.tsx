import { notFound } from "next/navigation";

import { PostForm } from "@/components/admin/post-form";
import { getAdminPost } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminPost(id);
  if (!post) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit post</h1>
      <p className="mt-2 text-muted-foreground">
        The cover is uploaded to /public/uploads/blog/ and album images to /public/uploads/blog/albums/.
      </p>
      <div className="mt-8">
        <PostForm
          mode="edit"
          postId={post.id}
          initial={{
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            readTime: post.readTime,
            coverImage: post.coverImage,
            images: post.images,
            isFeatured: post.isFeatured,
            source: post.source,
            sourceUrl: post.sourceUrl,
            publishedAt: post.publishedAt,
            isPublished: post.isPublished,
          }}
        />
      </div>
    </div>
  );
}
