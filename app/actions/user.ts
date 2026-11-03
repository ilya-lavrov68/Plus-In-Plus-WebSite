"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { findAccountById, recordActivity, updateAccount } from "@/lib/accounts";
import { getActionTranslator } from "@/lib/action-i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { withTransaction, type DbTransaction } from "@/lib/db";
import { assertPasswordNotCompromised, CompromisedPasswordError } from "@/lib/password-breach";
import { checkRateLimitAsync, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { logServerError } from "@/lib/security-log";
import { localAvatarPath } from "@/lib/upload-policy";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { firstIssueMessage, passwordSchema, profileSchema, utf8Bytes } from "@/lib/validators";

const WINDOW_MS = 10 * 60 * 1000;
class PasswordChangeError extends Error {}
export interface ChangePasswordInput { currentPassword: string; newPassword: string; confirmPassword: string }
export interface UpdateUserProfileInput { firstName?: string; lastName?: string; avatar?: string }
export interface UpdateUserProfileResult { ok: boolean; firstName: string | null; lastName: string | null; avatar: string | null }
function isFormData(value: unknown): value is FormData { return typeof FormData !== "undefined" && value instanceof FormData; }
async function writeActivity(tx: DbTransaction, action: string, userId: string) {
  await recordActivity({ action, entityType: "user", entityId: userId, title: "User account", actorId: userId }, tx);
}

export async function updateUserProfile(data: UpdateUserProfileInput | FormData): Promise<UpdateUserProfileResult> {
  const t = await getActionTranslator();
  if (!isAuthConfigured()) throw new Error(t("loginToEditProfile"));
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("loginToEditProfile"));
  if (!(await checkRateLimitAsync(hashRateLimitIdentifier(`profile:${session.user.id}`), 20, WINDOW_MS)).allowed) throw new Error(t("tooManyProfileUpdates"));
  const rawFirstName = isFormData(data) ? String(data.get("firstName") ?? "") : String(data?.firstName ?? "");
  const rawLastName = isFormData(data) ? String(data.get("lastName") ?? "") : String(data?.lastName ?? "");
  const parsed = profileSchema.safeParse({ firstName: rawFirstName, lastName: rawLastName });
  if (!parsed.success) throw new Error(t(firstIssueMessage(parsed.error)));

  const existing = await findAccountById(session.user.id);
  if (!existing || existing.isBlocked) throw new Error(t("unauthorized"));
  let uploadedAvatar: string | null = null;
  let nextAvatar: string | null | undefined;
  let saved = false;
  try {
    if (isFormData(data)) {
      const file = data.get("avatar");
      if (typeof file === "string" && file) throw new Error(t("chooseLocalImage"));
      if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError(t("emptyImage"));
      if (file instanceof File && file.size > 0) {
        uploadedAvatar = await saveImageUpload(file, "avatars");
        nextAvatar = uploadedAvatar;
      }
    } else if (data?.avatar !== undefined) {
      if (data.avatar === "") nextAvatar = null;
      else {
        const safePath = localAvatarPath(data.avatar);
        if (!safePath) throw new Error(t("chooseLocalImage"));
        nextAvatar = safePath;
      }
    }
    const updated = await withTransaction(async (tx) => {
      await updateAccount(
        existing.id,
        { firstName: parsed.data.firstName || null, lastName: parsed.data.lastName || null, ...(nextAvatar !== undefined ? { avatar: nextAvatar } : {}) },
        tx,
      );
      await writeActivity(tx, "updated profile", existing.id);
      return { ...existing, firstName: parsed.data.firstName || null, lastName: parsed.data.lastName || null, avatar: nextAvatar !== undefined ? nextAvatar : existing.avatar };
    });
    saved = true;
    if (uploadedAvatar && existing.avatar && existing.avatar !== uploadedAvatar) await cleanupUpload(existing.avatar, "avatars");
    revalidatePath("/profile");
    revalidatePath("/admin/collections/accounts");
    revalidatePath("/admin");
    return { ok: true, firstName: updated.firstName ?? null, lastName: updated.lastName ?? null, avatar: localAvatarPath(updated.avatar) };
  } catch (error) {
    if (uploadedAvatar && !saved) await cleanupUpload(uploadedAvatar, "avatars");
    if (error instanceof UploadValidationError) throw new Error(error.message);
    throw error instanceof Error ? error : new Error(t("profileSaveFailed"));
  }
}

export async function changePassword(data: ChangePasswordInput): Promise<{ ok: true }> {
  const t = await getActionTranslator();
  try {
    if (!isAuthConfigured()) throw new PasswordChangeError(t("loginToEditProfile"));
    const session = await auth();
    if (!session?.user?.id) throw new PasswordChangeError(t("loginToEditProfile"));
    if (!(await checkRateLimitAsync(hashRateLimitIdentifier(`password:${session.user.id}`), 5, WINDOW_MS)).allowed) throw new PasswordChangeError(t("tooManyPasswordChanges"));
    const currentPassword = typeof data?.currentPassword === "string" ? data.currentPassword : "";
    const newPassword = typeof data?.newPassword === "string" ? data.newPassword : "";
    const confirmPassword = typeof data?.confirmPassword === "string" ? data.confirmPassword : "";
    const parsed = passwordSchema.safeParse(newPassword);
    if (!currentPassword || utf8Bytes(currentPassword) > 72) throw new PasswordChangeError(t("currentPasswordIncorrect"));
    if (!parsed.success) throw new PasswordChangeError(t(firstIssueMessage(parsed.error)));
    if (newPassword !== confirmPassword) throw new PasswordChangeError(t("validation.passwordsDoNotMatch"));
    if (currentPassword === newPassword) throw new PasswordChangeError(t("passwordUnchanged"));

    const existing = await findAccountById(session.user.id);
    if (!existing || existing.isBlocked || !existing.passwordHash) throw new PasswordChangeError(t("unauthorized"));
    if (!(await bcrypt.compare(currentPassword, existing.passwordHash))) throw new PasswordChangeError(t("currentPasswordIncorrect"));
    try {
      await assertPasswordNotCompromised(newPassword);
    } catch (error) {
      if (error instanceof CompromisedPasswordError) throw new PasswordChangeError(t(error.code === "compromised" ? "validation.passwordCompromised" : "validation.passwordBreachUnavailable"));
      throw error;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await withTransaction(async (tx) => {
      const now = new Date().toISOString();
      await tx.run(
        `update auth_sessions set revoked_at = ?, revoke_reason = 'password_changed', updated_at = ?
         where user_id_id = ? and revoked_at is null`,
        [now, now, existing.id],
      );
      await updateAccount(existing.id, { passwordHash }, tx);
      await writeActivity(tx, "password changed", existing.id);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof PasswordChangeError) throw new Error(error.message);
    logServerError("auth.password.change_failed", error);
    throw new Error(t("passwordChangeFailed"));
  }
}
