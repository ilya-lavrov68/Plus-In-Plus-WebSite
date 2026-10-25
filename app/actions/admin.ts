"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin, requireFounder } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/security-log";
import { isSecretSiteSettingKey, isSiteSettingKey } from "@/lib/site-settings";
import type { Prisma } from "@/lib/generated/prisma/client";

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

    const user = await prisma.user.update({ where: { id: userId }, data: { role }, select: { id: true } });
    await prisma.activityLog.create({ data: { action: `role changed to ${role}`, entityType: "user", entityId: user.id, title: "User account", actorId: admin.id } });
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (error) {
    logServerError("admin.user.role_update_failed", error);
    return { ok: false, error: t("roleUpdateFailed") };
  }
}

export async function toggleUserBlocked(userId: string, blocked: boolean): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!validId(userId) || typeof blocked !== "boolean") return { ok: false, error: t("invalidUser") };
  if (admin.id === userId && blocked) return { ok: false, error: t("cannotBlockSelf") };
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: t("invalidUser") };
    // Основателя нельзя заблокировать из админки — иначе админ мог бы
    // «выключить» владельца сайта одним переключателем.
    if (target.role === "FOUNDER") return { ok: false, error: t("founderInvulnerable") };

    const user = await prisma.user.update({ where: { id: userId }, data: { isBlocked: blocked }, select: { id: true } });
    await prisma.activityLog.create({ data: { action: blocked ? "blocked" : "unblocked", entityType: "user", entityId: user.id, title: "User account", actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    logServerError("admin.user.block_update_failed", error);
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
    const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) }, select: { id: true } });
    await prisma.activityLog.create({ data: { action: "password reset", entityType: "user", entityId: user.id, title: "User account", actorId: admin.id } });
    revalidatePath("/admin/users");
    return { ok: true, temporaryPassword };
  } catch (error) {
    logServerError("admin.user.password_reset_failed", error);
    return { ok: false, error: t("passwordResetFailed") };
  }
}

class FeaturedPostUpdateError extends Error {}

async function applyFeaturedPost(tx: Prisma.TransactionClient, postId: string | null, actorId: string) {
  await tx.post.updateMany({ data: { isFeatured: false } });
  if (postId) {
    const selected = await tx.post.updateMany({
      where: {
        id: postId,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      data: { isFeatured: true },
    });
    if (selected.count !== 1) throw new FeaturedPostUpdateError();
  }
  await recordActivity(tx, {
    action: "updated",
    entityType: "post",
    entityId: postId ?? "none",
    title: "Featured post",
    actorId,
  });
}

/**
 * Настройки сайта ведёт ТОЛЬКО основатель: в той же таблице лежат пароли
 * Робокассы и токен Telegram-бота. Обычный админ сюда не допускается —
 * это тот же уровень доступа, что и вкладка Settings в интерфейсе.
 */
export async function updateSiteSettings(
  settings: Record<string, string>,
  featuredPostId?: string | null,
): Promise<AdminActionResult> {
  const t = await getActionTranslator();
  const admin = await requireFounder();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, error: t("invalidSettings") };
  }
  const entries = Object.entries(settings);
  if (
    entries.length > 100 ||
    entries.some(([key, value]) => !isSiteSettingKey(key) || typeof value !== "string" || value.length > 5000) ||
    (featuredPostId !== undefined && featuredPostId !== null && !validId(featuredPostId))
  ) {
    return { ok: false, error: t("invalidSettings") };
  }
  // Blank password/token fields mean "keep the configured value". Existing
  // secrets are never sent to the browser, so they cannot be round-tripped.
  const safeEntries = entries.filter(([key, value]) => !(isSecretSiteSettingKey(key) && value === ""));
  try {
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of safeEntries) {
        await tx.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }
      await recordActivity(tx, { action: "updated", entityType: "setting", entityId: "site", title: "Site settings", actorId: admin.id });
      if (featuredPostId !== undefined) {
        await applyFeaturedPost(tx, featuredPostId, admin.id);
      }
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    if (featuredPostId !== undefined) revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (error) {
    if (error instanceof FeaturedPostUpdateError) {
      return { ok: false, error: t("featuredPostUpdateFailed") };
    }
    logServerError("admin.settings.update_failed", error);
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
      await applyFeaturedPost(tx, postId, admin.id);
    });
    revalidatePath("/");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    logServerError("admin.featured_post.update_failed", error);
    return { ok: false, error: t("featuredPostUpdateFailed") };
  }
}
