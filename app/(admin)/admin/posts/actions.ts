"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { applyCoverChange, coverFileFrom } from "@/lib/cover-images";
import { insertPost, PostRuleError, updatePost } from "@/lib/post-rules";
import { UploadValidationError } from "@/lib/uploads";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

/**
 * Сохранение материала из админки. Доступно ADMIN/FOUNDER, правила
 * публикации — в lib/post-rules.ts, каждое изменение попадает в журнал.
 */
export async function savePost(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  if (!id) return;

  const title = field(formData, "title");
  if (title.length < 2 || title.length > 160) {
    redirect(`/admin/posts/${encodeURIComponent(id)}?error=${encodeURIComponent("Заголовок: от 2 до 160 символов.")}`);
  }

  try {
    await updatePost({
      id,
      title,
      slug: field(formData, "slug"),
      excerpt: field(formData, "excerpt"),
      content: String(formData.get("content") ?? ""),
      readTime: Number(field(formData, "readTime") || "5"),
      sourceUrl: field(formData, "sourceUrl") || null,
      isPublished: checkbox(formData, "isPublished"),
      isFeatured: checkbox(formData, "isFeatured"),
    });
  } catch (error) {
    if (error instanceof PostRuleError) {
      revalidatePath("/admin/posts");
      redirect(`/admin/posts/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  try {
    await applyCoverChange("posts", id, {
      file: coverFileFrom(formData),
      remove: formData.get("removeCover") === "on",
      current: field(formData, "currentCover") || null,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      redirect(`/admin/posts/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  await logAdminAction({
    action: "post.updated",
    entityType: "post",
    entityId: id,
    title: `Материал: ${title}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/posts");
  revalidatePath("/blog");
  revalidatePath("/");
  redirect(`/admin/posts/${encodeURIComponent(id)}?saved=1`);
}

/** Создание материала: правила публикации те же, что при правке. */
export async function createPost(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const title = field(formData, "title");
  if (title.length < 2 || title.length > 160) {
    redirect(`/admin/posts/new?error=${encodeURIComponent("Заголовок: от 2 до 160 символов.")}`);
  }

  try {
    const id = await insertPost({
      title,
      slug: field(formData, "slug"),
      excerpt: field(formData, "excerpt"),
      content: String(formData.get("content") ?? ""),
      readTime: Number(field(formData, "readTime") || "5"),
      sourceUrl: field(formData, "sourceUrl") || null,
      isPublished: checkbox(formData, "isPublished"),
      isFeatured: checkbox(formData, "isFeatured"),
    });

    try {
      await applyCoverChange("posts", id, { file: coverFileFrom(formData), remove: false, current: null });
    } catch (error) {
      if (error instanceof UploadValidationError) {
        // Запись уже создана: ошибку показываем в её карточке, а не на пустой
        // форме, иначе админ заполнит всё заново и получит дубль.
        redirect(`/admin/posts/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
      }
      throw error;
    }

    await logAdminAction({
      action: "post.created",
      entityType: "post",
      entityId: id,
      title: `Материал: ${title}`,
      actorId: admin.id,
    });

    revalidatePath("/admin/posts");
    revalidatePath("/blog");
    redirect(`/admin/posts/${encodeURIComponent(id)}?saved=1`);
  } catch (error) {
    if (error instanceof PostRuleError) {
      redirect(`/admin/posts/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
