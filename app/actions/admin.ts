"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin, requireFounder } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  temporaryPassword?: string;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 128;
}

/**
 * Роли, которые можно назначить из админки. FOUNDER сюда не входит
 * намеренно: основателя назначает только скрипт db:promote-admin с доступом
 * к базе, иначе любой админ мог бы выписать себе неуязвимость.
 */
export type AssignableRole = "USER" | "MANAGER" | "ADMIN";

const ASSIGNABLE_ROLES: readonly AssignableRole[] = ["USER", "MANAGER", "ADMIN"];

export async function updateUserRole(userId: string, role: AssignableRole): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!validId(userId) || !ASSIGNABLE_ROLES.includes(role)) return { ok: false, error: t("invalidUser") };
  if (admin.id === userId && role !== "ADMIN") return { ok: false, error: t("cannotRemoveOwnAdmin") };
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: t("invalidUser") };
    // ЖЁСТКОЕ ПРАВИЛО: основатель неприкосновенен. Его нельзя понизить,
    // повысить или «переназначить» — даже сам основатель не меняет свою роль
    // из админки. Снять FOUNDER можно только скриптом с доступом к БД.
    if (target.role === "FOUNDER") return { ok: false, error: t("founderInvulnerable") };

    const user = await prisma.user.update({ where: { id: userId }, data: { role } });
    await prisma.activityLog.create({ data: { action: `role changed to ${role}`, entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update user role:", error);
    return { ok: false, error: t("roleUpdateFailed") };
  }
}

export async function toggleUserBlocked(userId: string, blocked: boolean): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!validId(userId)) return { ok: false, error: t("invalidUser") };
  if (admin.id === userId && blocked) return { ok: false, error: t("cannotBlockSelf") };
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: t("invalidUser") };
    // Основателя нельзя заблокировать из админки — иначе админ мог бы
    // «выключить» владельца сайта одним переключателем.
    if (target.role === "FOUNDER") return { ok: false, error: t("founderInvulnerable") };

    const user = await prisma.user.update({ where: { id: userId }, data: { isBlocked: Boolean(blocked) } });
    await prisma.activityLog.create({ data: { action: blocked ? "blocked" : "unblocked", entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update user block status:", error);
    return { ok: false, error: t("userStatusUpdateFailed") };
  }
}

export async function resetUserPassword(userId: string): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!validId(userId)) return { ok: false, error: t("invalidUser") };
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: t("invalidUser") };
    // Сброс пароля основателю — это захват его аккаунта: временный пароль
    // видит тот, кто сбросил. Поэтому чужому FOUNDER пароль из админки не
    // сбрасывается никогда (себе — можно: он и так уже внутри).
    if (target.role === "FOUNDER" && admin.id !== userId) {
      return { ok: false, error: t("founderInvulnerable") };
    }

    const temporaryPassword = randomBytes(9).toString("base64url");
    const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) } });
    await prisma.activityLog.create({ data: { action: "password reset", entityType: "user", entityId: user.id, title: user.email, actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true, temporaryPassword };
  } catch (error) {
    console.error("Failed to reset user password:", error);
    return { ok: false, error: t("passwordResetFailed") };
  }
}

/**
 * Настройки сайта ведёт ТОЛЬКО основатель: в той же таблице лежат пароли
 * Робокассы и токен Telegram-бота. Обычный админ сюда не допускается —
 * это тот же уровень доступа, что и вкладка Settings в интерфейсе.
 */
export async function updateSiteSettings(settings: Record<string, string>): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireFounder();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!settings || typeof settings !== "object") return { ok: false, error: t("invalidSettings") };
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
    return { ok: false, error: t("settingsSaveFailed") };
  }
}

export async function setFeaturedPost(postId: string | null): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (postId !== null && !validId(postId)) return { ok: false, error: t("invalidPost") };
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
    return { ok: false, error: t("featuredPostUpdateFailed") };
  }
}
