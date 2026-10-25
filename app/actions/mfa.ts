"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { auth } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { revokeOtherAuthSessions } from "@/lib/auth-sessions";
import { parseJsonArray } from "@/lib/db-helpers";
import {
  createTotpSecret,
  encryptMfaSecret,
  generateBackupCodes,
  totpUri,
  verifyTotp,
} from "@/lib/mfa";
import {
  readPendingLogin,
  savePendingWebAuthnChallenge,
} from "@/lib/pending-login";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { logSecurityEvent, logServerError } from "@/lib/security-log";
import { profileName } from "@/lib/user-profile";
import { webAuthnConfigFromAction } from "@/lib/webauthn-config";

class AuthenticationRequired extends Error {}
class RateLimited extends Error {}

export interface MfaActionResult {
  ok: boolean;
  error?: string;
  backupCodes?: string[];
}

async function requireAccount() {
  const session = await auth();
  if (!session?.user?.id || !prisma) throw new AuthenticationRequired();
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      webAuthnCredentials: {
        select: { id: true, publicKey: true, counter: true, transports: true, name: true },
      },
    },
  });
  if (!account || account.isBlocked) throw new AuthenticationRequired();
  return account;
}

async function mfaRateLimit(userId: string, operation: string, limit = 10): Promise<void> {
  const result = await checkRateLimitAsync(
    hashRateLimitIdentifier(`mfa-${operation}:${userId}`),
    limit,
    10 * 60 * 1000,
  );
  if (!result.allowed) throw new RateLimited();
}

async function verifyOwner(
  account: { passwordHash: string; mfaSecret: string | null },
  password: unknown,
  code: unknown,
): Promise<"password" | "mfa" | null> {
  if (typeof password !== "string" || !password || !(await bcrypt.compare(password, account.passwordHash))) {
    return "password";
  }
  if (account.mfaSecret && !verifyTotp(account.mfaSecret, code)) return "mfa";
  return null;
}

export async function beginTotpSetup(): Promise<MfaActionResult & { secret?: string; qrCode?: string; otpauthUri?: string }> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "setup");
    if (account.mfaSecret) return { ok: false, error: t("mfaAlreadyEnabled") };
    const secret = createTotpSecret();
    const encrypted = encryptMfaSecret(secret);
    await prisma!.user.update({
      where: { id: account.id },
      data: { mfaPendingSecret: encrypted, mfaPendingCreatedAt: new Date() },
      select: { id: true },
    });
    const otpauthUri = totpUri(secret, account.email);
    const qrCode = await QRCode.toDataURL(otpauthUri, { width: 256, margin: 1, errorCorrectionLevel: "M" });
    return { ok: true, secret, qrCode, otpauthUri };
  } catch (error) {
    if (error instanceof AuthenticationRequired) return { ok: false, error: t("unauthorized") };
    if (error instanceof RateLimited) return { ok: false, error: t("tooManyMfaAttempts") };
    logServerError("auth.mfa.setup_failed", error);
    return { ok: false, error: t("mfaSetupFailed") };
  }
}

export async function enableTotp(code: string): Promise<MfaActionResult> {
  const t = await getActionTranslator();
  try {
    const account = await requireAccount();
    await mfaRateLimit(account.id, "verify", 5);
    if (!account.mfaPendingSecret || !account.mfaPendingCreatedAt || account.mfaPendingCreatedAt.getTime() < Date.now() - 10 * 60 * 1000) {
      return { ok: false, error: t("mfaSetupExpired") };
    }
    if (!verifyTotp(account.mfaPendingSecret, code)) return { ok: false, error: t("invalidMfaCode") };
    const firstFactor = !account.mfaSecret && account.webAuthnCredentials.length === 0;
    const backup = firstFactor ? generateBackupCodes() : null;
    await prisma!.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.id },
        data: {
          mfaSecret: account.mfaPendingSecret,
          mfaPendingSecret: null,
          mfaPendingCreatedAt: null,
          ...(firstFactor ? { mfaEnabledAt: new Date() } : {}),
        },
        select: { id: true },
      });
      if (backup) {
        await tx.mfaBackupCode.deleteMany({ where: { userId: account.id } });
        await tx.mfaBackupCode.createMany({
          data: backup.hashes.map((codeHash) => ({ userId: account.id, codeHash })),
        });
      }
      await recordActivity(tx, {
        action: "mfa enabled",
        entityType: "user",
        entityId: account.id,
        title: "User account",
        actorId: account.id,
      });
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
    if (!account.mfaSecret && account.webAuthnCredentials.length === 0) {
      return { ok: false, error: t("mfaNotEnabled") };
    }
    const failure = await verifyOwner(account, password, code);
    if (failure) return { ok: false, error: t(failure === "password" ? "currentPasswordIncorrect" : "invalidMfaCode") };
    const backup = generateBackupCodes();
    await prisma!.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({ where: { userId: account.id } });
      await tx.mfaBackupCode.createMany({
        data: backup.hashes.map((codeHash) => ({ userId: account.id, codeHash })),
      });
      await recordActivity(tx, {
        action: "backup codes regenerated",
        entityType: "user",
        entityId: account.id,
        title: "User account",
        actorId: account.id,
      });
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
    if (!pending || pending.user.webAuthnCredentials.length === 0) {
      return { ok: false as const, error: t("passkeyUnavailable") };
    }
    const limit = await checkRateLimitAsync(
      hashRateLimitIdentifier(`mfa-passkey-options:${pendingLoginId}`),
      10,
      5 * 60 * 1000,
    );
    if (!limit.allowed) return { ok: false as const, error: t("tooManyMfaAttempts") };
    const config = await webAuthnConfigFromAction();
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: "required",
      allowCredentials: pending.user.webAuthnCredentials.map((credential) => ({
        id: credential.id,
        transports: parseJsonArray(credential.transports),
      })),
    });
    if (!(await savePendingWebAuthnChallenge(pending.id, pending.secretHash, options.challenge))) {
      return { ok: false as const, error: t("invalidMfaCode") };
    }
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
      rpName: "Plus In Plus",
      rpID: config.rpID,
      userID: new TextEncoder().encode(account.id),
      userName: account.email,
      userDisplayName: profileName(account) || account.email,
      attestationType: "none",
      excludeCredentials: account.webAuthnCredentials.map((credential) => ({
        id: credential.id,
        transports: parseJsonArray(credential.transports),
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      supportedAlgorithmIDs: [-7, -257],
    });
    await prisma!.user.update({
      where: { id: account.id },
      data: {
        webAuthnRegistrationChallenge: options.challenge,
        webAuthnRegistrationChallengeExp: new Date(Date.now() + 10 * 60 * 1000),
      },
      select: { id: true },
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
    if (!account.webAuthnRegistrationChallenge || !account.webAuthnRegistrationChallengeExp || account.webAuthnRegistrationChallengeExp.getTime() <= Date.now()) {
      return { ok: false, error: t("mfaSetupExpired") };
    }
    if (!response || typeof response !== "object" || JSON.stringify(response).length > 32_768) {
      return { ok: false, error: t("passkeyFailed") };
    }
    const config = await webAuthnConfigFromAction();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: account.webAuthnRegistrationChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257],
    });
    if (!verification.verified) return { ok: false, error: t("passkeyFailed") };
    const firstFactor = !account.mfaSecret && account.webAuthnCredentials.length === 0;
    const backup = firstFactor ? generateBackupCodes() : null;
    const credential = verification.registrationInfo.credential;
    const safeName = typeof name === "string" && name.trim() && !/[\u0000-\u001f]/.test(name)
      ? name.trim().slice(0, 80)
      : "Passkey";
    await prisma!.$transaction(async (tx) => {
      await tx.webAuthnCredential.create({
        data: {
          id: credential.id,
          userId: account.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64url"),
          counter: String(credential.counter),
          transports: JSON.stringify(credential.transports ?? []),
          name: safeName,
        },
      });
      await tx.user.update({
        where: { id: account.id },
        data: {
          webAuthnRegistrationChallenge: null,
          webAuthnRegistrationChallengeExp: null,
          ...(firstFactor ? { mfaEnabledAt: new Date() } : {}),
        },
        select: { id: true },
      });
      if (backup) {
        await tx.mfaBackupCode.deleteMany({ where: { userId: account.id } });
        await tx.mfaBackupCode.createMany({
          data: backup.hashes.map((codeHash) => ({ userId: account.id, codeHash })),
        });
      }
      await recordActivity(tx, {
        action: "passkey added",
        entityType: "user",
        entityId: account.id,
        title: "User account",
        actorId: account.id,
      });
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
    const credential = account.webAuthnCredentials.find((item) => item.id === credentialId);
    if (!credential) return { ok: false, error: t("passkeyFailed") };
    const staff = account.role === "FOUNDER" || account.role === "ADMIN" || account.role === "MANAGER";
    const lastFactor = !account.mfaSecret && account.webAuthnCredentials.length === 1;
    if (staff && lastFactor) return { ok: false, error: t("staffMfaRequired") };

    await prisma!.$transaction(async (tx) => {
      await tx.webAuthnCredential.delete({ where: { id: credential.id } });
      if (lastFactor) {
        await tx.mfaBackupCode.deleteMany({ where: { userId: account.id } });
        await tx.user.update({
          where: { id: account.id },
          data: { mfaEnabledAt: null },
          select: { id: true },
        });
      }
      await recordActivity(tx, {
        action: "passkey removed",
        entityType: "user",
        entityId: account.id,
        title: "User account",
        actorId: account.id,
      });
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
