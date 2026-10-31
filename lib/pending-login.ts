import { createHash, randomBytes } from "node:crypto";

import { hashesEqual } from "@/lib/mfa";
import { getPayloadClient, payloadDate, payloadId, withPayloadTransaction } from "@/lib/payload-native";
import type { UserRole } from "@/lib/user-profile";

export const PENDING_LOGIN_SECONDS = 5 * 60;
export const MAX_PENDING_LOGIN_ATTEMPTS = 5;
const ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
function hashSecret(secret: string): string { return createHash("sha256").update(secret, "utf8").digest("hex"); }

export async function createPendingLogin(userId: string, role: UserRole): Promise<{ pendingLoginId: string; pendingLoginSecret: string }> {
  const payload = await getPayloadClient();
  const pendingLoginId = randomBytes(24).toString("base64url");
  const pendingLoginSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  await withPayloadTransaction(payload, async (req) => {
    await payload.delete({ collection: "pending-logins", where: { and: [{ userId: { equals: userId } }, { expiresAt: { less_than_equal: now.toISOString() } }] }, overrideAccess: true, req });
    await payload.create({
      collection: "pending-logins",
      data: { id: pendingLoginId, userId, role, secretHash: hashSecret(pendingLoginSecret), expiresAt: new Date(now.getTime() + PENDING_LOGIN_SECONDS * 1000).toISOString() },
      overrideAccess: true,
      req,
    });
    const recent = await payload.find({ collection: "pending-logins", depth: 0, pagination: false, sort: "-createdAt", overrideAccess: true, req, where: { userId: { equals: userId } } });
    const excess = recent.docs.slice(5).map((item) => item.id);
    if (excess.length) await payload.delete({ collection: "pending-logins", where: { id: { in: excess } }, overrideAccess: true, req });
  });
  return { pendingLoginId, pendingLoginSecret };
}

/** Returns null for every malformed, expired or secret-mismatch case. */
export async function readPendingLogin(pendingLoginId: unknown, pendingLoginSecret: unknown) {
  if (typeof pendingLoginId !== "string" || typeof pendingLoginSecret !== "string") return null;
  if (!ID_PATTERN.test(pendingLoginId) || !ID_PATTERN.test(pendingLoginSecret)) return null;
  const payload = await getPayloadClient();
  const result = await payload.find({ collection: "pending-logins", depth: 1, limit: 1, overrideAccess: true, where: { id: { equals: pendingLoginId } } });
  const pending = result.docs[0] as any;
  const expiresAt = payloadDate(pending?.expiresAt);
  if (!pending || !expiresAt || expiresAt.getTime() <= Date.now() || pending.attempts >= MAX_PENDING_LOGIN_ATTEMPTS) return null;
  const account = pending.userId && typeof pending.userId === "object" ? pending.userId : null;
  if (!account || account.isBlocked || !hashesEqual(pending.secretHash, hashSecret(pendingLoginSecret))) return null;
  const credentials = await payload.find({ collection: "webauthn-credentials", depth: 0, pagination: false, overrideAccess: true, where: { userId: { equals: account.id } } });
  return {
    ...pending,
    expiresAt,
    user: { ...account, webAuthnCredentials: credentials.docs },
    userId: payloadId(pending.userId),
  };
}

export async function recordPendingLoginFailure(pendingLoginId: string): Promise<void> {
  const payload = await getPayloadClient();
  await withPayloadTransaction(payload, async (req) => {
    const result = await payload.find({ collection: "pending-logins", depth: 0, limit: 1, overrideAccess: true, req, where: { id: { equals: pendingLoginId } } });
    const pending = result.docs[0];
    if (!pending || pending.attempts >= MAX_PENDING_LOGIN_ATTEMPTS) return;
    await payload.update({
      collection: "pending-logins",
      id: pending.id,
      data: { attempts: pending.attempts + 1 },
      overrideAccess: true,
      req,
    });
  });
}

export async function consumePendingLogin(pendingLoginId: string, secretHash: string): Promise<boolean> {
  const payload = await getPayloadClient();
  const consumed = await payload.delete({ collection: "pending-logins", where: { and: [{ id: { equals: pendingLoginId } }, { secretHash: { equals: secretHash } }] }, overrideAccess: true });
  return consumed.docs.length === 1;
}

export async function savePendingWebAuthnChallenge(pendingLoginId: string, secretHash: string, challenge: string): Promise<boolean> {
  const payload = await getPayloadClient();
  const updated = await payload.update({
    collection: "pending-logins",
    data: { webAuthnChallenge: challenge },
    overrideAccess: true,
    where: { and: [{ id: { equals: pendingLoginId } }, { secretHash: { equals: secretHash } }, { attempts: { less_than: MAX_PENDING_LOGIN_ATTEMPTS } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
  });
  return updated.docs.length === 1;
}

export function pendingSecretHash(secret: string): string { return hashSecret(secret); }
