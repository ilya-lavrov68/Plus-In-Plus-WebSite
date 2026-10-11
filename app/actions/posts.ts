"use server";

import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { revalidatePost } from "@/lib/revalidate-content";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
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

function parseCommonFields(form: FormData) {
  const rawContent = text(form, "content");
  if (rawContent.length > 100_000) return { error: "Post content is too long." };
  // Unsafe HTML is removed before validation, so a post is never stored (or
  // counted) as non-empty because of a script tag.
  const content = sanitizePostContent(rawContent);
  const result = createPostSchema.safeParse({
    title: text(form, "title"),
    slug: text(form, "slug"),
    excerpt: text(form, "excerpt"),
    content,
    readTime: Number(text(form, "readTime")),
    isPublished: form.get("isPublished") === "true" || form.get("isPublished") === "on",
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  const { isPublished } = result.data;
  return { data: { ...result.data, publishedAt: isPublished ? new Date() : null } };
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
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({ data: { ...parsed.data, coverImage: coverImage!, source: "manual" } });
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
    const publishedAt = parsed.data.isPublished && existing.publishedAt ? existing.publishedAt : parsed.data.publishedAt;
    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id }, data: { ...parsed.data, publishedAt, ...(newCover ? { coverImage: newCover } : {}) } });
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
