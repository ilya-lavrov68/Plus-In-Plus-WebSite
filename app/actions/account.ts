"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { findAccountById, recordActivity, updateAccount } from "@/lib/accounts";
import { getActionTranslator } from "@/lib/action-i18n";
import { requireAdmin } from "@/lib/admin-session";
import { withTransaction } from "@/lib/db";
import { logServerError } from "@/lib/security-log";

export interface AccountActionResult { ok: boolean; error?: string; temporaryPassword?: string }

/** Одноразовый временный пароль и отзыв всех сессий пользователя. */
export async function resetUserPassword(userId: string): Promise<AccountActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (typeof userId !== "string" || !userId || userId.length > 128) return { ok: false, error: t("invalidUser") };
  try {
    const target = await findAccountById(userId);
    if (!target) return { ok: false, error: t("invalidUser") };
    if (target.role === "FOUNDER") return { ok: false, error: t("founderInvulnerable") };
    const temporaryPassword = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await withTransaction(async (tx) => {
      const now = new Date().toISOString();
      await tx.run(
        `update auth_sessions set revoked_at = ?, revoke_reason = 'password_reset', updated_at = ?
         where user_id_id = ? and revoked_at is null`,
        [now, now, userId],
      );
      await updateAccount(userId, { passwordHash }, tx);
      await recordActivity(
        { action: "password reset", entityType: "user", entityId: userId, title: "User account", actorId: admin.id },
        tx,
      );
    });
    revalidatePath("/admin/collections/accounts");
    return { ok: true, temporaryPassword };
  } catch (error) {
    logServerError("admin.user.password_reset_failed", error);
    return { ok: false, error: t("passwordResetFailed") };
  }
}
