"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { deleteCoverUpload, saveCoverUpload } from "@/lib/uploads";

export interface ServiceActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const VALID_CATEGORIES = new Set(["small", "large"]);

function parseLines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCommonFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const shortDesc = String(formData.get("shortDesc") ?? "").trim();
  const fullDesc = String(formData.get("fullDesc") ?? "").trim();
  const includes = parseLines(formData.get("includes"));
  const shapes = parseLines(formData.get("shapes"));
  const resultText = String(formData.get("resultText") ?? "").trim();
  const isPublished = formData.get("isPublished") === "true" || formData.get("isPublished") === "on";

  if (!title) return { error: "Title is required." };
  if (!VALID_CATEGORIES.has(category)) return { error: "Category must be \"small\" or \"large\"." };
  if (!shortDesc) return { error: "Short description is required." };
  if (!fullDesc) return { error: "Full description is required." };
  if (!resultText) return { error: "Result text is required." };

  return {
    data: {
      title,
      category,
      shortDesc,
      fullDesc,
      includes,
      shapes,
      resultText,
      isPublished,
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

export async function createService(formData: FormData): Promise<ServiceActionResult> {
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
    // Covers always land in /public/uploads/services/ and the path goes to the DB.
    coverImage = await saveCoverUpload(cover, "services");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Cover upload failed." };
  }

  try {
    const service = await prisma.service.create({
      data: { ...parsed.data, coverImage },
    });
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/admin/services");
    return { ok: true, id: service.id };
  } catch (error) {
    console.error("Failed to create service:", error);
    await deleteCoverUpload(coverImage, "services");
    return { ok: false, error: "Failed to create the service." };
  }
}

export async function updateService(id: string, formData: FormData): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (!prisma) return { ok: false, error: "Database is not configured." };

  const parsed = parseCommonFields(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  let newCover: string | null = null;
  let saved = false;
  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Service not found." };

    const cover = await readCoverFile(formData);
    if (cover) newCover = await saveCoverUpload(cover, "services");

    await prisma.service.update({
      where: { id },
      data: { ...parsed.data, coverImage: newCover ?? existing.coverImage },
    });
    saved = true;
    // A cleanup failure must not roll back an already successful database update.
    if (newCover) await deleteCoverUpload(existing.coverImage, "services").catch(console.error);
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath(`/shop/${id}`);
    revalidatePath("/admin/services");
    return { ok: true, id };
  } catch (error) {
    if (newCover && !saved) await deleteCoverUpload(newCover, "services");
    console.error("Failed to update service:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the service." };
  }
}

export async function deleteService(id: string): Promise<ServiceActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (!prisma) return { ok: false, error: "Database is not configured." };

  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Service not found." };

    await prisma.service.delete({ where: { id } });
    await deleteCoverUpload(existing.coverImage, "services");
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/admin/services");
    return { ok: true, id };
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { ok: false, error: "Failed to delete the service." };
  }
}
