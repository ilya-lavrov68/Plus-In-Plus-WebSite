import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { hashesEqual } from "@/lib/mfa";
import { getPayloadClient, payloadDate, payloadId, withPayloadTransaction } from "@/lib/payload-native";
import { logSecurityEvent } from "@/lib/security-log";
import { MAX_CONCURRENT_SESSIONS, REFRESH_PRESENT_COOKIE, REFRESH_SESSION_SECONDS } from "@/lib/session-policy";
import { localAvatarPath } from "@/lib/upload-policy";
import type { UserRole } from "@/lib/user-profile";
import type { AuthSession } from "@/payload/payload-types";

const REFRESH_COOKIE = "pip-refresh";
const DEVICE_COOKIE = "pip-device";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
function production(): boolean { return process.env.NODE_ENV === "production"; }
export function refreshCookieName(): string { return production() ? `__Secure-${REFRESH_COOKIE}` : REFRESH_COOKIE; }
export function deviceCookieName(): string { return production() ? `__Secure-${DEVICE_COOKIE}` : DEVICE_COOKIE; }
export function hashRefreshSecret(secret: string): string { return createHash("sha256").update(secret, "utf8").digest("hex"); }
export function hashDevice(deviceId: string): string { return createHash("sha256").update(deviceId, "utf8").digest("hex"); }
function validRandomPart(value: unknown): value is string { return typeof value === "string" && TOKEN_PATTERN.test(value); }
export function parseRefreshToken(value: unknown): { id: string; secret: string } | null {
  if (typeof value !== "string") return null;
  const [id, secret, extra] = value.split(".");
  if (!validRandomPart(id) || !validRandomPart(secret) || extra) return null;
  return { id, secret };
}
async function writeRefreshCookies(sessionId: string, secret: string, deviceId: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  const secure = production();
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  jar.set(refreshCookieName(), `${sessionId}.${secret}`, { httpOnly: true, secure, sameSite: "lax", path: "/", expires: expiresAt, maxAge });
  jar.set(deviceCookieName(), deviceId, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60 });
  jar.set(REFRESH_PRESENT_COOKIE, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", expires: expiresAt, maxAge });
}
export async function clearRefreshCookies(): Promise<void> {
  const jar = await cookies();
  const options = { path: "/", secure: production(), sameSite: "lax" as const, maxAge: 0 };
  jar.set(refreshCookieName(), "", { ...options, httpOnly: true });
  jar.set(REFRESH_PRESENT_COOKIE, "", { ...options, httpOnly: false });
}
export async function readRefreshCookies(): Promise<{ refreshToken: string; deviceId: string }> {
  const jar = await cookies();
  return { refreshToken: jar.get(refreshCookieName())?.value ?? "", deviceId: jar.get(deviceCookieName())?.value ?? "" };
}

export async function createAuthSession(userId: string, role: UserRole): Promise<{ sessionId: string; deviceHash: string }> {
  const payload = await getPayloadClient();
  const jar = await cookies();
  const existingDevice = jar.get(deviceCookieName())?.value;
  const deviceId = validRandomPart(existingDevice) ? existingDevice : randomBytes(32).toString("base64url");
  const deviceHash = hashDevice(deviceId);
  const sessionId = randomBytes(24).toString("base64url");
  const refreshSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_SESSION_SECONDS * 1000);
  await withPayloadTransaction(payload, async (req) => {
    await payload.create({
      collection: "auth-sessions",
      data: { id: sessionId, userId, role, refreshHash: hashRefreshSecret(refreshSecret), deviceHash, lastUsedAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
      overrideAccess: true,
      req,
    });
    const active = await payload.find({
      collection: "auth-sessions",
      depth: 0,
      pagination: false,
      sort: "-lastUsedAt",
      overrideAccess: true,
      req,
      where: { and: [{ userId: { equals: userId } }, { revokedAt: { exists: false } }, { expiresAt: { greater_than: now.toISOString() } }] },
    });
    const excess = active.docs.slice(MAX_CONCURRENT_SESSIONS).map((session) => session.id);
    if (excess.length) {
      await payload.update({
        collection: "auth-sessions",
        data: { revokedAt: now.toISOString(), revokeReason: "session_limit" },
        overrideAccess: true,
        req,
        where: { and: [{ id: { in: excess } }, { revokedAt: { exists: false } }] },
      });
    }
  });
  try {
    await writeRefreshCookies(sessionId, refreshSecret, deviceId, expiresAt);
  } catch (error) {
    await payload.update({
      collection: "auth-sessions",
      data: { revokedAt: new Date().toISOString(), revokeReason: "cookie_write_failed" },
      overrideAccess: true,
      where: { and: [{ id: { equals: sessionId } }, { revokedAt: { exists: false } }] },
    });
    throw error;
  }
  return { sessionId, deviceHash };
}

export interface RotatedAuthSession {
  sessionId: string;
  deviceHash: string;
  role: UserRole;
  user: { id: string; email: string; firstName: string | null; lastName: string | null; avatar: string | null };
}

export async function rotateAuthSession(rawRefreshToken: string, deviceId: string): Promise<RotatedAuthSession | null> {
  const parsed = parseRefreshToken(rawRefreshToken);
  if (!parsed || !validRandomPart(deviceId)) return null;
  const payload = await getPayloadClient();
  const presentedHash = hashRefreshSecret(parsed.secret);
  const presentedDeviceHash = hashDevice(deviceId);
  const result = await payload.find({
    collection: "auth-sessions",
    depth: 1,
    limit: 1,
    overrideAccess: true,
    where: { id: { equals: parsed.id } },
  });
  const existing = result.docs[0] as AuthSession | undefined;
  const expiresAt = payloadDate(existing?.expiresAt);
  const account = existing?.userId && typeof existing.userId === "object" ? existing.userId : null;
  if (!existing || existing.revokedAt || !expiresAt || expiresAt.getTime() <= Date.now() || !account || account.isBlocked) return null;
  if (!hashesEqual(existing.deviceHash, presentedDeviceHash)) {
    logSecurityEvent("auth.refresh.device_mismatch");
    return null;
  }
  const userId = payloadId(existing.userId)!;
  if (!hashesEqual(existing.refreshHash, presentedHash)) {
    await revokeAllAuthSessions(userId, "refresh_reuse");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }
  const role: UserRole = (existing.role === "FOUNDER" || existing.role === "ADMIN" || existing.role === "MANAGER") && existing.role === account.role ? existing.role : "USER";
  const nextSecret = randomBytes(32).toString("base64url");
  const rotated = await payload.update({
    collection: "auth-sessions",
    data: { refreshHash: hashRefreshSecret(nextSecret), lastUsedAt: new Date().toISOString(), role },
    overrideAccess: true,
    where: { and: [{ id: { equals: existing.id } }, { refreshHash: { equals: presentedHash } }, { revokedAt: { exists: false } }] },
  });
  if (rotated.docs.length !== 1) {
    await revokeAllAuthSessions(userId, "refresh_race");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }
  await writeRefreshCookies(existing.id, nextSecret, deviceId, expiresAt);
  return {
    sessionId: existing.id,
    deviceHash: existing.deviceHash,
    role,
    user: { id: account.id, email: account.email, firstName: account.firstName ?? null, lastName: account.lastName ?? null, avatar: localAvatarPath(account.avatar ?? null) },
  };
}

export async function authSessionIsActive(sessionId: string, deviceHash: string): Promise<boolean> {
  if (!validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return false;
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "auth-sessions",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ id: { equals: sessionId } }, { revokedAt: { exists: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
  });
  const session = result.docs[0];
  return Boolean(session && hashesEqual(session.deviceHash, deviceHash));
}

export async function downgradeAuthSession(sessionId: string, deviceHash: string): Promise<void> {
  if (!validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "auth-sessions",
    data: { role: "USER" },
    overrideAccess: true,
    where: { and: [{ id: { equals: sessionId } }, { deviceHash: { equals: deviceHash } }, { revokedAt: { exists: false } }, { role: { not_equals: "USER" } }] },
  });
}

export async function revokeAllAuthSessions(userId: string, reason: string): Promise<void> {
  const payload = await getPayloadClient();
  await payload.update({
    collection: "auth-sessions",
    data: { revokedAt: new Date().toISOString(), revokeReason: reason.slice(0, 64) },
    overrideAccess: true,
    where: { and: [{ userId: { equals: userId } }, { revokedAt: { exists: false } }] },
  });
}

export async function revokeOtherAuthSessions(userId: string, reason: string): Promise<void> {
  const { refreshToken } = await readRefreshCookies();
  const current = parseRefreshToken(refreshToken);
  const payload = await getPayloadClient();
  await payload.update({
    collection: "auth-sessions",
    data: { revokedAt: new Date().toISOString(), revokeReason: reason.slice(0, 64) },
    overrideAccess: true,
    where: { and: [{ userId: { equals: userId } }, { revokedAt: { exists: false } }, ...(current ? [{ id: { not_equals: current.id } }] : [])] },
  });
}

export async function revokeCurrentAuthSession(reason = "logout"): Promise<void> {
  const { refreshToken, deviceId } = await readRefreshCookies();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed || !validRandomPart(deviceId)) return;
  const payload = await getPayloadClient();
  await payload.update({
    collection: "auth-sessions",
    data: { revokedAt: new Date().toISOString(), revokeReason: reason },
    overrideAccess: true,
    where: { and: [{ id: { equals: parsed.id } }, { deviceHash: { equals: hashDevice(deviceId) } }, { revokedAt: { exists: false } }] },
  });
}
