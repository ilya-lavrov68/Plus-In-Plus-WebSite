"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { requireAdmin } from "@/lib/admin-session";
import { getPayloadClient, withPayloadTransaction } from "@/lib/payload-native";
import { logServerError } from "@/lib/security-log";

export interface AccountActionResult { ok: boolean; error?: string; temporaryPassword?: string }

/** Payload document control: one-time temporary password, all sessions revoked. */
export async function resetUserPassword(userId: string): Promise<AccountActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: t("unauthorized") };
  if (typeof userId !== "string" || !userId || userId.length > 128) return { ok: false, error: t("invalidUser") };
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, where: { id: { equals: userId } } });
    const target = result.docs[0];
    if (!target) return { ok: false, error: t("invalidUser") };
    if (target.role === "FOUNDER" && admin.id !== userId) return { ok: false, error: t("founderInvulnerable") };
    const temporaryPassword = randomBytes(9).toString("base64url");
    await withPayloadTransaction(payload, async (req) => {
      await payload.update({
        collection: "auth-sessions",
        data: { revokedAt: new Date().toISOString(), revokeReason: "password_reset" },
        overrideAccess: true,
        req,
        where: { and: [{ userId: { equals: userId } }, { revokedAt: { exists: false } }] },
      });
      await payload.update({ collection: "accounts", id: userId, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) }, overrideAccess: true, req });
      await payload.create({ collection: "activity-logs", data: { action: "password reset", entityType: "user", entityId: userId, title: "User account", actorId: admin.id }, overrideAccess: true, req });
    });
    revalidatePath("/admin/collections/accounts");
    return { ok: true, temporaryPassword };
  } catch (error) {
    logServerError("admin.user.password_reset_failed", error);
    return { ok: false, error: t("passwordResetFailed") };
  }
}
