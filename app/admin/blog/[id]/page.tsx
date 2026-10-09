import { notFound } from "next/navigation";

import { PostForm } from "@/components/admin/post-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  if (!prisma) {
    notFound();
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!post) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit post</h1>
      <p className="mt-2 text-muted-foreground">
        The cover is uploaded to /public/uploads/blog/ and its path is saved in the database.
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
            isPublished: post.isPublished,
          }}
        />
      </div>
    </div>
  );
}
