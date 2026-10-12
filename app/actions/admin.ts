"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  temporaryPassword?: string;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 128;
}

export async function updateUserRole(userId: string, role: "USER" | "ADMIN"): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!validId(userId) || (role !== "USER" && role !== "ADMIN")) return { ok: false, error: "Invalid user." };
  if (admin.id === userId && role !== "ADMIN") return { ok: false, error: "You cannot remove your own admin access." };
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: { role } });
    await prisma.activityLog.create({ data: { action: `role changed to ${role}`, entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update user role:", error);
    return { ok: false, error: "The user role could not be changed." };
  }
}

export async function toggleUserBlocked(userId: string, blocked: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!validId(userId)) return { ok: false, error: "Invalid user." };
  if (admin.id === userId && blocked) return { ok: false, error: "You cannot block your own account." };
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: { isBlocked: Boolean(blocked) } });
    await prisma.activityLog.create({ data: { action: blocked ? "blocked" : "unblocked", entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update user block status:", error);
    return { ok: false, error: "The user status could not be changed." };
  }
}

export async function resetUserPassword(userId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!validId(userId)) return { ok: false, error: "Invalid user." };
  const temporaryPassword = randomBytes(9).toString("base64url");
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) } });
    await prisma.activityLog.create({ data: { action: "password reset", entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true, temporaryPassword };
  } catch (error) {
    console.error("Failed to reset user password:", error);
    return { ok: false, error: "The password could not be reset." };
  }
}

export async function updateSiteSettings(settings: Record<string, string>): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (!settings || typeof settings !== "object") return { ok: false, error: "Invalid settings." };
  const safeEntries = Object.entries(settings).filter(([key, value]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key) && typeof value === "string").slice(0, 100);
  try {
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of safeEntries) {
        await tx.siteSetting.upsert({ where: { key }, update: { value: value.slice(0, 5000) }, create: { key, value: value.slice(0, 5000) } });
      }
      await recordActivity(tx, { action: "updated", entityType: "setting", entityId: "site", title: "Site settings", actorId: admin.id });
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update site settings:", error);
    return { ok: false, error: "Settings could not be saved." };
  }
}

export async function setFeaturedPost(postId: string | null): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: "Unauthorized." };
  if (postId !== null && !validId(postId)) return { ok: false, error: "Invalid post." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.post.updateMany({ data: { isFeatured: false } });
      if (postId) await tx.post.update({ where: { id: postId }, data: { isFeatured: true } });
      await recordActivity(tx, { action: "updated", entityType: "post", entityId: postId ?? "none", title: "Featured post", actorId: admin.id });
    });
    revalidatePath("/");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to set featured post:", error);
    return { ok: false, error: "Featured post could not be updated." };
  }
}
