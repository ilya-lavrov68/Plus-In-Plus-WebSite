"use server";

import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { cleanupPostCoverIfUnused } from "@/lib/media-cleanup";
import { revalidatePost } from "@/lib/revalidate-content";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import {
  isMarkdownPostContent,
  markdownSource,
  MAX_POST_SOURCE_LENGTH,
  toMarkdownPostContent,
} from "@/lib/post-content-format";
import * as uploadModule from "@/lib/uploads";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { createPostSchema, firstIssueMessage } from "@/lib/validators";
import type { MessageTranslator } from "@/lib/i18n-messages";

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

function parseCommonFields(form: FormData, t: MessageTranslator) {
  const rawContent = text(form, "content");
  const wantsMarkdown =
    text(form, "contentFormat") === "markdown" || isMarkdownPostContent(rawContent);
  const sourceContent = wantsMarkdown ? markdownSource(rawContent) : rawContent;
  if (sourceContent.length > MAX_POST_SOURCE_LENGTH) return { error: t("postTooLong") };
  // Markdown remains lossless for later editing and is rendered/sanitized for
  // public output. HTML keeps the existing sanitize-before-validation boundary.
  const content = wantsMarkdown ? sourceContent : sanitizePostContent(rawContent);

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
  if (!result.success) return { error: t(firstIssueMessage(result.error)) };
  const { isPublished } = result.data;
  return {
    data: {
      ...result.data,
      content: wantsMarkdown
        ? toMarkdownPostContent(result.data.content)
        : result.data.content,
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

function coverFile(form: FormData, t: MessageTranslator): File | null {
  const file = form.get("cover");
  if (typeof file === "string" && file) throw new UploadValidationError(t("uploadLocalCover"));
  if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError(t("emptyImage"));
  return file instanceof File && file.size > 0 ? file : null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createPost(formData: FormData): Promise<PostActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!(formData instanceof FormData)) return { ok: false, error: t("invalidForm") };
  const parsed = parseCommonFields(formData, t);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let coverImage: string | null = null;
  let id: string;
  try {
    const cover = coverFile(formData, t);
    if (!cover) return { ok: false, error: t("coverRequired") };
    coverImage = await saveImageUpload(cover, "blog");
    const finalImages = await processAlbumFiles(formData, parsed.data.images ?? null);

    const post = await prisma.$transaction(async (tx) => {
      // The post form has the same single-Featured invariant as the dedicated
      // dashboard/settings control. Clear the previous selection atomically.
      if (parsed.data.isFeatured) {
        await tx.post.updateMany({ data: { isFeatured: false } });
      }
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
    if (isUniqueViolation(error)) return { ok: false, error: t("slugExistsPost") };
    console.error("Failed to create post:", error);
    return { ok: false, error: t("createPostFailed") };
  }
  revalidatePost(id, parsed.data.slug);
  return { ok: true, id };
}

export async function updatePost(id: string, formData: FormData): Promise<PostActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128 || !(formData instanceof FormData)) return { ok: false, error: t("invalidRequest") };
  const parsed = parseCommonFields(formData, t);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let newCover: string | null = null;
  let oldCover: string | null = null;
  let oldSlug = parsed.data.slug;
  try {
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: t("postNotFound") };
    oldCover = existing.coverImage;
    oldSlug = existing.slug;
    const cover = coverFile(formData, t);
    if (cover) newCover = await saveImageUpload(cover, "blog");
    const finalImages = await processAlbumFiles(formData, parsed.data.images ?? null);
    const hasScheduledDate = Boolean(text(formData, "publishedAt"));
    const publishedAt = parsed.data.isPublished
      ? hasScheduledDate
        ? parsed.data.publishedAt ?? new Date()
        : existing.publishedAt ?? new Date()
      : null;

    await prisma.$transaction(async (tx) => {
      if (parsed.data.isFeatured) {
        await tx.post.updateMany({
          where: { id: { not: id } },
          data: { isFeatured: false },
        });
      }
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
    if (isUniqueViolation(error)) return { ok: false, error: t("slugExistsPost") };
    console.error("Failed to update post:", error);
    return { ok: false, error: t("updatePostFailed") };
  }
  if (newCover) await cleanupPostCoverIfUnused(oldCover);
  revalidatePost(id, oldSlug, parsed.data.slug);
  return { ok: true, id };
}

export async function bulkUpdatePosts(ids: string[], action: "publish" | "unpublish" | "delete"): Promise<PostActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return { ok: false, error: t("selectValidPost") };
  }
  if (action !== "publish" && action !== "unpublish" && action !== "delete") {
    return { ok: false, error: t("invalidRequest") };
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
          if (action === "publish" && post.isFeatured) {
            await tx.post.updateMany({
              where: { id: { not: id } },
              data: { isFeatured: false },
            });
          }
          await tx.post.update({ where: { id }, data: { isPublished: action === "publish", publishedAt: action === "publish" ? post.publishedAt ?? new Date() : null } });
          await recordActivity(tx, { action: action === "publish" ? "published" : "unpublished", entityType: "post", entityId: id, title: post.title, actorId: admin.id });
        }
      }
    });
  } catch (error) {
    console.error("Failed to update posts in bulk:", error);
    return { ok: false, error: t("bulkUpdatePostsFailed") };
  }
  await Promise.all(removedCovers.map((cover) => cleanupPostCoverIfUnused(cover)));
  ids.forEach((id) => revalidatePost(id));
  revalidatePath("/admin/blog");
  return { ok: true };
}

export async function duplicatePost(id: string): Promise<PostActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: t("invalidPostId") };
  try {
    const source = await prisma.post.findUnique({ where: { id } });
    if (!source) return { ok: false, error: t("postNotFound") };
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
    return { ok: false, error: t("duplicatePostFailed") };
  }
}

export async function deletePost(id: string): Promise<PostActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: t("invalidPostId") };
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
    return { ok: false, error: t("deletePostFailed") };
  }
  await cleanupPostCoverIfUnused(cover);
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
