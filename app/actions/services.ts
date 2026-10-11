"use server";

import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { parseLineList, toJsonArray } from "@/lib/db-helpers";
import { prisma } from "@/lib/prisma";
import { revalidateService } from "@/lib/revalidate-content";
import { slugify, withNumericSuffix } from "@/lib/slug";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { createServiceSchema, firstIssueMessage } from "@/lib/validators";

export interface ServiceActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseCommonFields(form: FormData) {
  const result = createServiceSchema.safeParse({
    title: text(form, "title"),
    slug: text(form, "slug") || undefined,
    category: text(form, "category"),
    shortDesc: text(form, "shortDesc"),
    fullDesc: text(form, "fullDesc"),
    includes: parseLineList(text(form, "includes")),
    shapes: parseLineList(text(form, "shapes")),
    resultText: text(form, "resultText"),
    isPublished: form.get("isPublished") === "true" || form.get("isPublished") === "on",
  });
  if (!result.success) return { error: firstIssueMessage(result.error) };
  return { data: result.data };
}

/**
 * Slugs are unique in the database; a human title can repeat. Falls back to
 * `title-2`, `title-3`, … so saving never fails with a raw constraint error.
 */
async function resolveServiceSlug(base: string, excludeId?: string): Promise<string> {
  if (!prisma) return base;
  for (let index = 1; index < 50; index += 1) {
    const candidate = withNumericSuffix(base, index);
    const existing = await prisma.service.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
  }
  return withNumericSuffix(base, Date.now() % 1000 + 50);
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

export async function createService(formData: FormData): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!(formData instanceof FormData)) return { ok: false, error: "Invalid form." };
  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let coverImage: string | null = null;
  let id: string;
  let slug = parsed.data.slug ?? slugify(parsed.data.title, "service");
  try {
    const cover = coverFile(formData);
    if (!cover) return { ok: false, error: "Cover image is required." };
    slug = await resolveServiceSlug(slug);
    coverImage = await saveImageUpload(cover, "services");
    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          ...parsed.data,
          slug,
          // SQLite has no JSON column: lists are stored as JSON strings.
          includes: toJsonArray(parsed.data.includes),
          shapes: toJsonArray(parsed.data.shapes),
          coverImage: coverImage!,
        },
      });
      await recordActivity(tx, { action: "created", entityType: "service", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    id = service.id;
  } catch (error) {
    await cleanupUpload(coverImage, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "A service with this slug already exists." };
    console.error("Failed to create service:", error);
    return { ok: false, error: "Failed to create the service." };
  }
  revalidateService(id, slug);
  return { ok: true, id };
}

export async function updateService(id: string, formData: FormData): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128 || !(formData instanceof FormData)) return { ok: false, error: "Invalid request." };
  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let newCover: string | null = null;
  let oldCover: string | null = null;
  let slug = parsed.data.slug ?? "";
  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Service not found." };
    oldCover = existing.coverImage;
    // An existing service keeps its URL unless the form explicitly sends a new slug.
    slug = parsed.data.slug ? await resolveServiceSlug(parsed.data.slug, id) : existing.slug;
    const cover = coverFile(formData);
    if (cover) newCover = await saveImageUpload(cover, "services");
    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          ...parsed.data,
          slug,
          includes: toJsonArray(parsed.data.includes),
          shapes: toJsonArray(parsed.data.shapes),
          ...(newCover ? { coverImage: newCover } : {}),
        },
      });
      await recordActivity(tx, { action: "updated", entityType: "service", entityId: id, title: parsed.data.title, actorId: admin.id });
    });
  } catch (error) {
    await cleanupUpload(newCover, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "A service with this slug already exists." };
    console.error("Failed to update service:", error);
    return { ok: false, error: "Failed to update the service." };
  }
  if (newCover) await cleanupUpload(oldCover, "services");
  revalidateService(id, slug);
  return { ok: true, id };
}

export async function deleteService(id: string): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: "Invalid service id." };
  let cover: string | null = null;
  let slug = "";
  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.service.delete({ where: { id } });
      cover = deleted.coverImage;
      slug = deleted.slug;
      await recordActivity(tx, { action: "deleted", entityType: "service", entityId: id, title: deleted.title, actorId: admin.id });
    });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { ok: false, error: "Service could not be deleted. It may have already been removed." };
  }
  await cleanupUpload(cover, "services");
  revalidateService(id, slug);
  return { ok: true, id };
}
