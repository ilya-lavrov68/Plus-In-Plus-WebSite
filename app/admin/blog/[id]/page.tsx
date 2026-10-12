import { notFound } from "next/navigation";

import { PostForm } from "@/components/admin/post-form";
import { getAdminPost } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, t] = await Promise.all([getAdminPost(id), getRequestTranslations("admin")]);
  if (!post) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("editPost")}</h1>
      <p className="mt-2 text-muted-foreground">{t("form.editPostSubtitle")}</p>
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
