"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";

import { auth } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { revokeOtherAuthSessions } from "@/lib/auth-sessions";
import { parseJsonArray } from "@/lib/db-helpers";
import { createTotpSecret, decryptMfaSecret, encryptMfaSecret, generateBackupCodes, totpUri, verifyTotp } from "@/lib/mfa";
import { readPendingLogin, savePendingWebAuthnChallenge } from "@/lib/pending-login";
import { getPayloadClient, payloadDate, type PayloadTransactionRequest, withPayloadTransaction } from "@/lib/payload-native";
import { checkRateLimitAsync, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { logSecurityEvent, logServerError } from "@/lib/security-log";
import { profileName } from "@/lib/user-profile";
import { webAuthnConfigFromAction } from "@/lib/webauthn-config";
import type { Account } from "@/payload/payload-types";

class AuthenticationRequired extends Error {}
class RateLimited extends Error {}
const TOTP_SETUP_TTL_MS = 10 * 60 * 1000;
export interface MfaActionResult { ok: boolean; error?: string; backupCodes?: string[] }
export interface TotpSetupResult extends MfaActionResult { secret?: string; qrCode?: string; otpauthUri?: string; setupId?: number; setupExpiresIn?: number }
export interface TotpEnableResult extends MfaActionResult { failureReason?: "invalid-code" | "stale-setup" }

async function writeActivity(payload: Awaited<ReturnType<typeof getPayloadClient>>, req: PayloadTransactionRequest, action: string, userId: string) {
  await payload.create({ collection: "activity-logs", data: { action, entityType: "user", entityId: userId, title: "User account", actorId: userId }, overrideAccess: true, req });
}
async function requireAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationRequired();
  const payload = await getPayloadClient();
  const result = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, showHiddenFields: true, where: { id: { equals: session.user.id } } });
  const account = result.docs[0] as Account | undefined;
  if (!account || account.isBlocked) throw new AuthenticationRequired();
  const credentials = await payload.find({ collection: "webauthn-credentials", depth: 0, pagination: false, overrideAccess: true, where: { userId: { equals: account.id } } });
  return {
    ...account,
    mfaPendingCreatedAt: payloadDate(account.mfaPendingCreatedAt),
    webAuthnRegistrationChallengeExp: payloadDate(account.webAuthnRegistrationChallengeExp),
    webAuthnCredentials: credentials.docs,
  };
}
async function mfaRateLimit(userId: string, operation: string, limit = 10): Promise<void> {
  const result = await checkRateLimitAsync(hashRateLimitIdentifier(`mfa-${operation}:${userId}`), limit, 10 * 60 * 1000);
  if (!result.allowed) throw new RateLimited();
}
async function verifyOwner(account: { passwordHash?: string | null; mfaSecret?: string | null }, password: unknown, code: unknown): Promise<"password" | "mfa" | null> {
  if (!account.passwordHash || typeof password !== "string" || !password || !(await bcrypt.compare(password, account.passwordHash))) return "password";
  if (account.mfaSecret && !verifyTotp(account.mfaSecret, code)) return "mfa";
  return null;
}

export async function beginTotpSetup(): Promise<TotpSetupResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "setup");
    if (account.mfaSecret) return { ok: false, error: t("mfaAlreadyEnabled") };
    const payload = await getPayloadClient();
    const cutoff = Date.now() - TOTP_SETUP_TTL_MS;
    const enrollment = await withPayloadTransaction(payload, async (req) => {
      const currentResult = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, showHiddenFields: true, req, where: { id: { equals: account.id } } });
      const current = currentResult.docs[0] as Account | undefined;
      if (!current || current.isBlocked) throw new AuthenticationRequired();
      if (current.mfaSecret) return { already: true as const };
      const pendingAt = payloadDate(current.mfaPendingCreatedAt);
      if (current.mfaPendingSecret && pendingAt && pendingAt.getTime() >= cutoff) {
        try { return { secret: decryptMfaSecret(current.mfaPendingSecret), createdAt: pendingAt }; } catch { /* replace unreadable pending enrollment */ }
      }
      const secret = createTotpSecret();
      const createdAt = new Date();
      await payload.update({
        collection: "accounts",
        id: account.id,
        data: { mfaPendingSecret: encryptMfaSecret(secret), mfaPendingCreatedAt: createdAt.toISOString() },
        overrideAccess: true,
        req,
      });
      return { secret, createdAt };
    });
    if ("already" in enrollment) return { ok: false, error: t("mfaAlreadyEnabled") };
    const setupId = enrollment.createdAt.getTime();
    const otpauthUri = totpUri(enrollment.secret, account.email);
    const qrCode = await QRCode.toDataURL(otpauthUri, { width: 256, margin: 1, errorCorrectionLevel: "M" });
    return { ok: true, secret: enrollment.secret, qrCode, otpauthUri, setupId, setupExpiresIn: Math.max(0, setupId + TOTP_SETUP_TTL_MS - Date.now()) };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.setup_failed", error);
    return { ok: false, error: t("mfaSetupFailed") };
  }
}

export async function enableTotp(code: string, setupId?: number): Promise<TotpEnableResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "verify", 5);
    if (!account.mfaPendingSecret || !account.mfaPendingCreatedAt || account.mfaPendingCreatedAt.getTime() < Date.now() - TOTP_SETUP_TTL_MS) return { ok: false, error: t("mfaSetupExpired"), failureReason: "stale-setup" };
    if (setupId !== undefined && (!Number.isSafeInteger(setupId) || account.mfaPendingCreatedAt.getTime() !== setupId)) return { ok: false, error: t("mfaSetupExpired"), failureReason: "stale-setup" };
    if (!verifyTotp(account.mfaPendingSecret, code)) {
      logSecurityEvent("auth.mfa.failed");
      return { ok: false, error: t("invalidMfaCode"), failureReason: "invalid-code" };
    }
    const firstFactor = !account.mfaSecret && account.webAuthnCredentials.length === 0;
    const backup = firstFactor ? generateBackupCodes() : null;
    const payload = await getPayloadClient();
    await withPayloadTransaction(payload, async (req) => {
      await payload.update({
        collection: "accounts",
        id: account.id,
        data: { mfaSecret: account.mfaPendingSecret, mfaPendingSecret: null, mfaPendingCreatedAt: null, ...(firstFactor ? { mfaEnabledAt: new Date().toISOString() } : {}) },
        overrideAccess: true,
        req,
      });
      if (backup) {
        await payload.delete({ collection: "mfa-backup-codes", where: { userId: { equals: account.id } }, overrideAccess: true, req });
        for (const codeHash of backup.hashes) await payload.create({ collection: "mfa-backup-codes", data: { userId: account.id, codeHash }, overrideAccess: true, req });
      }
      await writeActivity(payload, req, "mfa enabled", account.id);
    });
    if (firstFactor) await revokeOtherAuthSessions(account.id, "mfa_enabled");
    logSecurityEvent("auth.mfa.setup_complete");
    revalidatePath("/profile");
    return { ok: true, ...(backup ? { backupCodes: backup.codes } : {}) };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.setup_failed", error);
    return { ok: false, error: t("mfaSetupFailed") };
  }
}

export async function regenerateBackupCodes(password: string, code: string): Promise<MfaActionResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "backup", 5);
    if (!account.mfaSecret && account.webAuthnCredentials.length === 0) return { ok: false, error: t("mfaNotEnabled") };
    const failure = await verifyOwner(account, password, code);
    if (failure) return { ok: false, error: t(failure === "password" ? "currentPasswordIncorrect" : "invalidMfaCode") };
    const backup = generateBackupCodes();
    const payload = await getPayloadClient();
    await withPayloadTransaction(payload, async (req) => {
      await payload.delete({ collection: "mfa-backup-codes", where: { userId: { equals: account.id } }, overrideAccess: true, req });
      for (const codeHash of backup.hashes) await payload.create({ collection: "mfa-backup-codes", data: { userId: account.id, codeHash }, overrideAccess: true, req });
      await writeActivity(payload, req, "backup codes regenerated", account.id);
    });
    revalidatePath("/profile");
    return { ok: true, backupCodes: backup.codes };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.setup_failed", error);
    return { ok: false, error: t("mfaSetupFailed") };
  }
}

export async function getMfaPasskeyOptions(pendingLoginId: string, pendingLoginSecret: string) {
  const t = await getActionTranslator();
  try {
    const pending = await readPendingLogin(pendingLoginId, pendingLoginSecret);
    if (!pending || pending.user.webAuthnCredentials.length === 0) return { ok: false as const, error: t("passkeyUnavailable") };
    const limit = await checkRateLimitAsync(hashRateLimitIdentifier(`mfa-passkey-options:${pendingLoginId}`), 10, 5 * 60 * 1000);
    if (!limit.allowed) return { ok: false as const, error: t("tooManyMfaAttempts") };
    const config = await webAuthnConfigFromAction();
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: "required",
      allowCredentials: pending.user.webAuthnCredentials.map((credential: { id: string; transports: string }) => ({ id: credential.id, transports: parseJsonArray(credential.transports) })),
    });
    if (!(await savePendingWebAuthnChallenge(pending.id, pending.secretHash, options.challenge))) return { ok: false as const, error: t("invalidMfaCode") };
    return { ok: true as const, options };
  } catch (error) {
    logServerError("auth.mfa.passkey_failed", error);
    return { ok: false as const, error: t("passkeyUnavailable") };
  }
}

export async function beginPasskeyRegistration() {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "passkey-setup");
    const config = await webAuthnConfigFromAction();
    const options = await generateRegistrationOptions({
      rpName: "Plus In Plus", rpID: config.rpID, userID: new TextEncoder().encode(account.id), userName: account.email,
      userDisplayName: profileName(account) || account.email, attestationType: "none",
      excludeCredentials: account.webAuthnCredentials.map((credential: { id: string; transports: string }) => ({ id: credential.id, transports: parseJsonArray(credential.transports) })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" }, supportedAlgorithmIDs: [-7, -257],
    });
    const payload = await getPayloadClient();
    await payload.update({
      collection: "accounts", id: account.id,
      data: { webAuthnRegistrationChallenge: options.challenge, webAuthnRegistrationChallengeExp: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
      overrideAccess: true,
    });
    return { ok: true as const, options };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false as const, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false as const, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.passkey_failed", error);
    return { ok: false as const, error: t("passkeyUnavailable") };
  }
}

type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]["response"];
export async function finishPasskeyRegistration(response: RegistrationResponse, name: string): Promise<MfaActionResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "passkey-verify", 5);
    if (!account.webAuthnRegistrationChallenge || !account.webAuthnRegistrationChallengeExp || account.webAuthnRegistrationChallengeExp.getTime() <= Date.now()) return { ok: false, error: t("mfaSetupExpired") };
    if (!response || typeof response !== "object" || JSON.stringify(response).length > 32_768) return { ok: false, error: t("passkeyFailed") };
    const config = await webAuthnConfigFromAction();
    const verification = await verifyRegistrationResponse({ response, expectedChallenge: account.webAuthnRegistrationChallenge, expectedOrigin: config.origin, expectedRPID: config.rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    if (!verification.verified) return { ok: false, error: t("passkeyFailed") };
    const firstFactor = !account.mfaSecret && account.webAuthnCredentials.length === 0;
    const backup = firstFactor ? generateBackupCodes() : null;
    const credential = verification.registrationInfo.credential;
    const safeName = typeof name === "string" && name.trim() && !/[\u0000-\u001f]/.test(name) ? name.trim().slice(0, 80) : "Passkey";
    const payload = await getPayloadClient();
    await withPayloadTransaction(payload, async (req) => {
      await payload.create({
        collection: "webauthn-credentials",
        data: { id: credential.id, userId: account.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: String(credential.counter), transports: JSON.stringify(credential.transports ?? []), name: safeName },
        overrideAccess: true,
        req,
      });
      await payload.update({ collection: "accounts", id: account.id, data: { webAuthnRegistrationChallenge: null, webAuthnRegistrationChallengeExp: null, ...(firstFactor ? { mfaEnabledAt: new Date().toISOString() } : {}) }, overrideAccess: true, req });
      if (backup) {
        await payload.delete({ collection: "mfa-backup-codes", where: { userId: { equals: account.id } }, overrideAccess: true, req });
        for (const codeHash of backup.hashes) await payload.create({ collection: "mfa-backup-codes", data: { userId: account.id, codeHash }, overrideAccess: true, req });
      }
      await writeActivity(payload, req, "passkey added", account.id);
    });
    if (firstFactor) await revokeOtherAuthSessions(account.id, "mfa_enabled");
    logSecurityEvent("auth.mfa.setup_complete");
    revalidatePath("/profile");
    return { ok: true, ...(backup ? { backupCodes: backup.codes } : {}) };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.passkey_failed", error);
    return { ok: false, error: t("passkeyFailed") };
  }
}

export async function removePasskey(credentialId: string, password: string, code: string): Promise<MfaActionResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "passkey-remove", 5);
    if (typeof credentialId !== "string" || credentialId.length > 1024) return { ok: false, error: t("passkeyFailed") };
    const failure = await verifyOwner(account, password, code);
    if (failure) return { ok: false, error: t(failure === "password" ? "currentPasswordIncorrect" : "invalidMfaCode") };
    const credential = account.webAuthnCredentials.find((item: { id: string }) => item.id === credentialId);
    if (!credential) return { ok: false, error: t("passkeyFailed") };
    const staff = account.role === "FOUNDER" || account.role === "ADMIN" || account.role === "MANAGER";
    const lastFactor = !account.mfaSecret && account.webAuthnCredentials.length === 1;
    if (staff && lastFactor) return { ok: false, error: t("staffMfaRequired") };
    const payload = await getPayloadClient();
    await withPayloadTransaction(payload, async (req) => {
      await payload.delete({ collection: "webauthn-credentials", where: { and: [{ id: { equals: credential.id } }, { userId: { equals: account.id } }] }, overrideAccess: true, req });
      if (lastFactor) {
        await payload.delete({ collection: "mfa-backup-codes", where: { userId: { equals: account.id } }, overrideAccess: true, req });
        await payload.update({ collection: "accounts", id: account.id, data: { mfaEnabledAt: null }, overrideAccess: true, req });
      }
      await writeActivity(payload, req, "passkey removed", account.id);
    });
    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.passkey_failed", error);
    return { ok: false, error: t("passkeyFailed") };
  }
}
