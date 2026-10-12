"use server";

import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { revalidatePost } from "@/lib/revalidate-content";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import * as uploadModule from "@/lib/uploads";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { createPostSchema, firstIssueMessage } from "@/lib/validators";

export interface PostActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function scheduledDate(form: FormData): Date | null {
  const value = text(form, "publishedAt");
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCommonFields(form: FormData) {
  const rawContent = text(form, "content");
  if (rawContent.length > 100_000) return { error: "Post content is too long." };
  // Unsafe HTML is removed before validation, so a post is never stored (or
  // counted) as non-empty because of a script tag.
  const content = sanitizePostContent(rawContent);

  const rawSourceUrl = text(form, "sourceUrl");
  const rawSource = text(form, "source") || "manual";
  const rawImages = form.get("images");
  let imagesJson: string | null = null;
  if (typeof rawImages === "string" && rawImages.trim()) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        imagesJson = JSON.stringify(parsed.map(String));
      } else {
        imagesJson = rawImages.trim();
      }
    } catch {
      imagesJson = rawImages.trim();
    }
  }

  const result = createPostSchema.safeParse({
    title: text(form, "title"),
    slug: text(form, "slug"),
    excerpt: text(form, "excerpt"),
    content,
    readTime: Number(text(form, "readTime")),
    isPublished: form.get("isPublished") === "true" || form.get("isPublished") === "on",
    isFeatured: form.get("isFeatured") === "true" || form.get("isFeatured") === "on",
    source: rawSource,
    sourceUrl: rawSourceUrl || null,
    images: imagesJson,
    publishedAt: scheduledDate(form),
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  const { isPublished } = result.data;
  return {
    data: {
      ...result.data,
      // A selected datetime is kept for scheduling. Publishing without one is immediate.
      publishedAt: isPublished ? result.data.publishedAt ?? new Date() : null,
    },
  };
}

async function processAlbumFiles(form: FormData, initialImagesJson: string | null): Promise<string | null> {
  let imagesList: string[] = [];
  if (initialImagesJson) {
    try {
      const parsed = JSON.parse(initialImagesJson);
      if (Array.isArray(parsed)) imagesList = parsed.map(String);
    } catch {
      imagesList = [initialImagesJson];
    }
  }

  const files = form.getAll("album").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    for (const file of files) {
      const saveFn =
        typeof (uploadModule as Record<string, unknown>).saveAlbumImage === "function"
          ? (uploadModule as { saveAlbumImage: (f: File) => Promise<string> }).saveAlbumImage
          : (f: File) => saveImageUpload(f, "blog");
      const url = await saveFn(file);
      imagesList.push(url);
    }
  }

  return imagesList.length > 0 ? JSON.stringify(imagesList) : null;
}

function coverFile(form: FormData): File | null {
  const file = form.get("cover");
  if (typeof file === "string" && file) throw new UploadValidationError("Please upload a local cover image.");
  if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError("Image must not be empty.");
  return file instanceof File && file.size > 0 ? file : null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createPost(formData: FormData): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!(formData instanceof FormData)) return { ok: false, error: "Invalid form." };
  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let coverImage: string | null = null;
  let id: string;
  try {
    const cover = coverFile(formData);
    if (!cover) return { ok: false, error: "Cover image is required." };
    coverImage = await saveImageUpload(cover, "blog");
    const finalImages = await processAlbumFiles(formData, parsed.data.images ?? null);

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          ...parsed.data,
          coverImage: coverImage!,
          images: finalImages,
        },
      });
      await recordActivity(tx, { action: "created", entityType: "post", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    id = post.id;
  } catch (error) {
    await cleanupUpload(coverImage, "blog");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "A post with this slug already exists." };
    console.error("Failed to create post:", error);
    return { ok: false, error: "Failed to create the post." };
  }
  revalidatePost(id, parsed.data.slug);
  return { ok: true, id };
}

export async function updatePost(id: string, formData: FormData): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128 || !(formData instanceof FormData)) return { ok: false, error: "Invalid request." };
  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let newCover: string | null = null;
  let oldCover: string | null = null;
  let oldSlug = parsed.data.slug;
  try {
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Post not found." };
    oldCover = existing.coverImage;
    oldSlug = existing.slug;
    const cover = coverFile(formData);
    if (cover) newCover = await saveImageUpload(cover, "blog");
    const finalImages = await processAlbumFiles(formData, parsed.data.images ?? null);
    const hasScheduledDate = Boolean(text(formData, "publishedAt"));
    const publishedAt = parsed.data.isPublished
      ? hasScheduledDate
        ? parsed.data.publishedAt ?? new Date()
        : existing.publishedAt ?? new Date()
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: {
          ...parsed.data,
          images: finalImages,
          publishedAt,
          ...(newCover ? { coverImage: newCover } : {}),
        },
      });
      await recordActivity(tx, { action: "updated", entityType: "post", entityId: id, title: parsed.data.title, actorId: admin.id });
    });
  } catch (error) {
    await cleanupUpload(newCover, "blog");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "A post with this slug already exists." };
    console.error("Failed to update post:", error);
    return { ok: false, error: "Failed to update the post." };
  }
  if (newCover) await cleanupUpload(oldCover, "blog");
  revalidatePost(id, oldSlug, parsed.data.slug);
  return { ok: true, id };
}

export async function bulkUpdatePosts(ids: string[], action: "publish" | "unpublish" | "delete"): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return { ok: false, error: "Select at least one valid post." };
  }
  const removedCovers: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const post = await tx.post.findUnique({ where: { id } });
        if (!post) continue;
        if (action === "delete") {
          if (post.coverImage) removedCovers.push(post.coverImage);
          await tx.post.delete({ where: { id } });
          await recordActivity(tx, { action: "deleted", entityType: "post", entityId: id, title: post.title, actorId: admin.id });
        } else {
          await tx.post.update({ where: { id }, data: { isPublished: action === "publish", publishedAt: action === "publish" ? post.publishedAt ?? new Date() : null } });
          await recordActivity(tx, { action: action === "publish" ? "published" : "unpublished", entityType: "post", entityId: id, title: post.title, actorId: admin.id });
        }
      }
    });
  } catch (error) {
    console.error("Failed to update posts in bulk:", error);
    return { ok: false, error: "The selected posts could not be updated." };
  }
  await Promise.all(removedCovers.map((cover) => cleanupUpload(cover, "blog")));
  ids.forEach((id) => revalidatePost(id));
  revalidatePath("/admin/blog");
  return { ok: true };
}

export async function duplicatePost(id: string): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: "Invalid post id." };
  try {
    const source = await prisma.post.findUnique({ where: { id } });
    if (!source) return { ok: false, error: "Post not found." };
    const baseSlug = `${source.slug}-copy`;
    let slug = baseSlug;
    for (let index = 2; index < 100; index += 1) {
      const existing = await prisma.post.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${index}`;
    }
    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          title: `${source.title} (Copy)`,
          slug,
          excerpt: source.excerpt,
          content: source.content,
          coverImage: source.coverImage,
          images: source.images,
          readTime: source.readTime,
          source: source.source,
          sourceUrl: source.sourceUrl,
          isFeatured: false,
          isPublished: false,
          publishedAt: null,
        },
      });
      await recordActivity(tx, { action: "duplicated", entityType: "post", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    revalidatePath("/admin/blog");
    return { ok: true, id: copy.id };
  } catch (error) {
    console.error("Failed to duplicate post:", error);
    return { ok: false, error: "The post could not be duplicated." };
  }
}

export async function deletePost(id: string): Promise<PostActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: "Invalid post id." };
  let cover: string | null = null;
  let slug = "";
  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.post.delete({ where: { id } });
      cover = deleted.coverImage;
      slug = deleted.slug;
      await recordActivity(tx, { action: "deleted", entityType: "post", entityId: id, title: deleted.title, actorId: admin.id });
    });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return { ok: false, error: "Post could not be deleted. It may have already been removed." };
  }
  await cleanupUpload(cover, "blog");
  revalidatePost(id, slug);
  return { ok: true, id };
}

export async function getFeaturedPostAction() {
  if (!prisma) return null;
  try {
    let post = await prisma.post.findFirst({
      where: { isPublished: true, isFeatured: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });
    if (!post) {
      post = await prisma.post.findFirst({
        where: { isPublished: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      });
    }
    return post
      ? {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          coverImage: post.coverImage,
          isFeatured: post.isFeatured,
        }
      : null;
  } catch (error) {
    console.error("Failed to load featured post:", error);
    return null;
  }
}
