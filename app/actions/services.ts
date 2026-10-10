"use server";

import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { revalidateService } from "@/lib/revalidate-content";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";

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
  const title = text(form, "title");
  const category = text(form, "category");
  const shortDesc = text(form, "shortDesc");
  const fullDesc = text(form, "fullDesc");
  const resultText = text(form, "resultText");
  const includesText = text(form, "includes");
  const shapesText = text(form, "shapes");
  if (!title || title.length > 160) return { error: "Title is required and must be at most 160 characters." };
  if (category !== "small" && category !== "large") return { error: 'Category must be "small" or "large".' };
  if (!shortDesc || shortDesc.length > 500) return { error: "Short description is required (up to 500 characters)." };
  if (!fullDesc || fullDesc.length > 100_000) return { error: "Full description is required (up to 100,000 characters)." };
  if (!resultText || resultText.length > 10_000) return { error: "Result text is required (up to 10,000 characters)." };
  if (includesText.length > 10_000 || shapesText.length > 10_000) return { error: "Includes and shapes must be at most 10,000 characters each." };
  const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const includes = lines(includesText);
  const shapes = lines(shapesText);
  if (includes.length > 100 || shapes.length > 100) return { error: "Use no more than 100 items per list." };
  const isPublished = form.get("isPublished") === "true" || form.get("isPublished") === "on";
  return { data: { title, category, shortDesc, fullDesc, includes, shapes, resultText, isPublished } };
}

function coverFile(form: FormData): File | null {
  const file = form.get("cover");
  if (typeof file === "string" && file) throw new UploadValidationError("Please upload a local cover image.");
  if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError("Image must not be empty.");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function createService(formData: FormData): Promise<ServiceActionResult> {
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
    coverImage = await saveImageUpload(cover, "services");
    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({ data: { ...parsed.data, coverImage: coverImage! } });
      await recordActivity(tx, { action: "created", entityType: "service", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    id = service.id;
  } catch (error) {
    await cleanupUpload(coverImage, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    console.error("Failed to create service:", error);
    return { ok: false, error: "Failed to create the service." };
  }
  revalidateService(id);
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
  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Service not found." };
    oldCover = existing.coverImage;
    const cover = coverFile(formData);
    if (cover) newCover = await saveImageUpload(cover, "services");
    await prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: { ...parsed.data, ...(newCover ? { coverImage: newCover } : {}) } });
      await recordActivity(tx, { action: "updated", entityType: "service", entityId: id, title: parsed.data.title, actorId: admin.id });
    });
  } catch (error) {
    await cleanupUpload(newCover, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    console.error("Failed to update service:", error);
    return { ok: false, error: "Failed to update the service." };
  }
  if (newCover) await cleanupUpload(oldCover, "services");
  revalidateService(id);
  return { ok: true, id };
}

export async function deleteService(id: string): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: "Invalid service id." };
  let cover: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.service.delete({ where: { id } });
      cover = deleted.coverImage;
      await recordActivity(tx, { action: "deleted", entityType: "service", entityId: id, title: deleted.title, actorId: admin.id });
    });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { ok: false, error: "Service could not be deleted. It may have already been removed." };
  }
  await cleanupUpload(cover, "services");
  revalidateService(id);
  return { ok: true, id };
}
