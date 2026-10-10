"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import { deleteCoverUpload, saveCoverUpload } from "@/lib/uploads";

export interface PostActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseCommonFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const rawContent = String(formData.get("content") ?? "").trim();
  if (rawContent.length > 100_000) return { error: "Post content is too long." };
  const content = sanitizePostContent(rawContent);
  const readTimeRaw = String(formData.get("readTime") ?? "").trim();
  const readTime = Number(readTimeRaw);
  const isPublished = formData.get("isPublished") === "true" || formData.get("isPublished") === "on";

  if (!title) return { error: "Title is required." };
  if (title.length > 160) return { error: "Title is too long." };
  if (slug.length > 120 || !SLUG_PATTERN.test(slug)) {
    return { error: "Slug must contain only lowercase letters, numbers and dashes." };
  }
  if (!excerpt) return { error: "Excerpt is required." };
  if (excerpt.length > 500) return { error: "Excerpt is too long." };
  if (!content.trim()) return { error: "Content is required after unsafe HTML is removed." };
  if (!Number.isInteger(readTime) || readTime <= 0 || readTime > 1440) {
    return { error: "Read time must be between 1 and 1440 minutes." };
  }

  return {
    data: {
      title,
      slug,
      excerpt,
      content,
      readTime,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
  };
}

async function readCoverFile(formData: FormData): Promise<File | null> {
  const file = formData.get("cover");
  if (file instanceof File && file.size > 0) {
    return file;
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createPost(formData: FormData): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (!prisma) return { ok: false, error: "Database is not configured." };

  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  let coverImage = "";
  try {
    const cover = await readCoverFile(formData);
    if (!cover) {
      return { ok: false, error: "Cover image is required." };
    }
    // Covers always land in /public/uploads/blog/ and the path goes to the DB.
    coverImage = await saveCoverUpload(cover, "blog");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Cover upload failed." };
  }

  try {
    const post = await prisma.post.create({
      data: { ...parsed.data, coverImage },
    });
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath("/shop");
    revalidatePath("/admin/blog");
    return { ok: true, id: post.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      await deleteCoverUpload(coverImage, "blog");
      return { ok: false, error: "A post with this slug already exists." };
    }
    console.error("Failed to create post:", error);
    await deleteCoverUpload(coverImage, "blog");
    return { ok: false, error: "Failed to create the post." };
  }
}

export async function updatePost(id: string, formData: FormData): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (!prisma) return { ok: false, error: "Database is not configured." };

  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  let newCover: string | null = null;
  let saved = false;
  try {
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Post not found." };

    const cover = await readCoverFile(formData);
    if (cover) newCover = await saveCoverUpload(cover, "blog");

    // Keep the original publish date when the post stays published.
    const publishedAt =
      parsed.data.isPublished && existing.publishedAt ? existing.publishedAt : parsed.data.publishedAt;

    await prisma.post.update({
      where: { id },
      data: { ...parsed.data, publishedAt, coverImage: newCover ?? existing.coverImage },
    });
    saved = true;
    // A cleanup failure must not roll back an already successful database update.
    if (newCover) await deleteCoverUpload(existing.coverImage, "blog").catch(console.error);
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${existing.slug}`);
    if (existing.slug !== parsed.data.slug) revalidatePath(`/blog/${parsed.data.slug}`);
    revalidatePath("/shop");
    revalidatePath("/admin/blog");
    return { ok: true, id };
  } catch (error) {
    if (newCover && !saved) await deleteCoverUpload(newCover, "blog");
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A post with this slug already exists." };
    }
    console.error("Failed to update post:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the post." };
  }
}

export async function deletePost(id: string): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (!prisma) return { ok: false, error: "Database is not configured." };

  try {
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Post not found." };

    await prisma.post.delete({ where: { id } });
    await deleteCoverUpload(existing.coverImage, "blog");
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${existing.slug}`);
    revalidatePath("/shop");
    revalidatePath("/admin/blog");
    return { ok: true, id };
  } catch (error) {
    console.error("Failed to delete post:", error);
    return { ok: false, error: "Failed to delete the post." };
  }
}
