import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { hashesEqual } from "@/lib/mfa";
import type { UserRole } from "@/lib/user-profile";

export const PENDING_LOGIN_SECONDS = 5 * 60;
export const MAX_PENDING_LOGIN_ATTEMPTS = 5;
const ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export async function createPendingLogin(
  userId: string,
  role: UserRole,
): Promise<{ pendingLoginId: string; pendingLoginSecret: string }> {
  if (!prisma) throw new Error("MFA login storage is unavailable.");
  const pendingLoginId = randomBytes(24).toString("base64url");
  const pendingLoginSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pendingLogin.deleteMany({ where: { userId, expiresAt: { lte: now } } });
    await tx.pendingLogin.create({
      data: {
        id: pendingLoginId,
        userId,
        role,
        secretHash: hashSecret(pendingLoginSecret),
        createdAt: now,
        expiresAt: new Date(now.getTime() + PENDING_LOGIN_SECONDS * 1000),
      },
    });
    const recent = await tx.pendingLogin.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const excess = recent.slice(5).map((item) => item.id);
    if (excess.length) await tx.pendingLogin.deleteMany({ where: { id: { in: excess } } });
  });
  return { pendingLoginId, pendingLoginSecret };
}

/** Returns null for every malformed, expired or secret-mismatch case. */
export async function readPendingLogin(pendingLoginId: unknown, pendingLoginSecret: unknown) {
  if (!prisma || typeof pendingLoginId !== "string" || typeof pendingLoginSecret !== "string") return null;
  if (!ID_PATTERN.test(pendingLoginId) || !ID_PATTERN.test(pendingLoginSecret)) return null;
  const pending = await prisma.pendingLogin.findUnique({
    where: { id: pendingLoginId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          isBlocked: true,
          mfaSecret: true,
          webAuthnCredentials: {
            select: { id: true, publicKey: true, counter: true, transports: true },
          },
        },
      },
    },
  });
  if (!pending || pending.expiresAt.getTime() <= Date.now() || pending.attempts >= MAX_PENDING_LOGIN_ATTEMPTS) {
    return null;
  }
  if (pending.user.isBlocked || !hashesEqual(pending.secretHash, hashSecret(pendingLoginSecret))) return null;
  return pending;
}

export async function recordPendingLoginFailure(pendingLoginId: string): Promise<void> {
  if (!prisma) return;
  await prisma.pendingLogin.updateMany({
    where: { id: pendingLoginId, attempts: { lt: MAX_PENDING_LOGIN_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
}

/** Deletion is the replay boundary: only one successful caller can consume a challenge. */
export async function consumePendingLogin(pendingLoginId: string, secretHash: string): Promise<boolean> {
  if (!prisma) return false;
  const consumed = await prisma.pendingLogin.deleteMany({ where: { id: pendingLoginId, secretHash } });
  return consumed.count === 1;
}

export async function savePendingWebAuthnChallenge(
  pendingLoginId: string,
  secretHash: string,
  challenge: string,
): Promise<boolean> {
  if (!prisma) return false;
  const updated = await prisma.pendingLogin.updateMany({
    where: {
      id: pendingLoginId,
      secretHash,
      attempts: { lt: MAX_PENDING_LOGIN_ATTEMPTS },
      expiresAt: { gt: new Date() },
    },
    data: { webAuthnChallenge: challenge },
  });
  return updated.count === 1;
}

export function pendingSecretHash(secret: string): string {
  return hashSecret(secret);
}
