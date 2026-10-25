import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { hashesEqual } from "@/lib/mfa";
import { logSecurityEvent } from "@/lib/security-log";
import {
  MAX_CONCURRENT_SESSIONS,
  REFRESH_PRESENT_COOKIE,
  REFRESH_SESSION_SECONDS,
} from "@/lib/session-policy";
import { localAvatarPath } from "@/lib/upload-policy";
import type { UserRole } from "@/lib/user-profile";

const REFRESH_COOKIE = "pip-refresh";
const DEVICE_COOKIE = "pip-device";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function production(): boolean {
  return process.env.NODE_ENV === "production";
}

export function refreshCookieName(): string {
  return production() ? `__Secure-${REFRESH_COOKIE}` : REFRESH_COOKIE;
}

export function deviceCookieName(): string {
  return production() ? `__Secure-${DEVICE_COOKIE}` : DEVICE_COOKIE;
}

export function hashRefreshSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function hashDevice(deviceId: string): string {
  return createHash("sha256").update(deviceId, "utf8").digest("hex");
}

function validRandomPart(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function parseRefreshToken(value: unknown): { id: string; secret: string } | null {
  if (typeof value !== "string") return null;
  const [id, secret, extra] = value.split(".");
  if (!validRandomPart(id) || !validRandomPart(secret) || extra) return null;
  return { id, secret };
}

async function writeRefreshCookies(
  sessionId: string,
  secret: string,
  deviceId: string,
  expiresAt: Date,
): Promise<void> {
  const jar = await cookies();
  const secure = production();
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  jar.set(refreshCookieName(), `${sessionId}.${secret}`, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge,
  });
  jar.set(deviceCookieName(), deviceId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  // Non-sensitive marker only: lets the browser know it may attempt a refresh
  // without making unauthenticated visitors call the endpoint every few minutes.
  jar.set(REFRESH_PRESENT_COOKIE, "1", {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge,
  });
}

export async function clearRefreshCookies(): Promise<void> {
  const jar = await cookies();
  const options = { path: "/", secure: production(), sameSite: "lax" as const, maxAge: 0 };
  jar.set(refreshCookieName(), "", { ...options, httpOnly: true });
  jar.set(REFRESH_PRESENT_COOKIE, "", { ...options, httpOnly: false });
}

export async function readRefreshCookies(): Promise<{ refreshToken: string; deviceId: string }> {
  const jar = await cookies();
  return {
    refreshToken: jar.get(refreshCookieName())?.value ?? "",
    deviceId: jar.get(deviceCookieName())?.value ?? "",
  };
}

/** Creates one server-side refresh session and keeps only the newest three. */
export async function createAuthSession(
  userId: string,
  role: UserRole,
): Promise<{ sessionId: string; deviceHash: string }> {
  if (!prisma) throw new Error("Session storage is unavailable.");
  const jar = await cookies();
  const existingDevice = jar.get(deviceCookieName())?.value;
  const deviceId = validRandomPart(existingDevice) ? existingDevice : randomBytes(32).toString("base64url");
  const deviceHash = hashDevice(deviceId);
  const sessionId = randomBytes(24).toString("base64url");
  const refreshSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_SESSION_SECONDS * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.authSession.create({
      data: {
        id: sessionId,
        userId,
        role,
        refreshHash: hashRefreshSecret(refreshSecret),
        deviceHash,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
      },
    });
    const active = await tx.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true },
    });
    const excess = active.slice(MAX_CONCURRENT_SESSIONS).map((session) => session.id);
    if (excess.length) {
      await tx.authSession.updateMany({
        where: { id: { in: excess }, revokedAt: null },
        data: { revokedAt: now, revokeReason: "session_limit" },
      });
    }
  });

  try {
    await writeRefreshCookies(sessionId, refreshSecret, deviceId, expiresAt);
  } catch (error) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "cookie_write_failed" },
    });
    throw error;
  }
  return { sessionId, deviceHash };
}

export interface RotatedAuthSession {
  sessionId: string;
  deviceHash: string;
  role: UserRole;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
}

/**
 * Rotates exactly once. A previously valid token that is presented again fails
 * closed and revokes all sessions for that account (refresh-reuse response).
 */
export async function rotateAuthSession(
  rawRefreshToken: string,
  deviceId: string,
): Promise<RotatedAuthSession | null> {
  if (!prisma) return null;
  const parsed = parseRefreshToken(rawRefreshToken);
  if (!parsed || !validRandomPart(deviceId)) return null;
  const presentedHash = hashRefreshSecret(parsed.secret);
  const presentedDeviceHash = hashDevice(deviceId);
  const existing = await prisma.authSession.findUnique({
    where: { id: parsed.id },
    select: {
      id: true,
      userId: true,
      role: true,
      refreshHash: true,
      deviceHash: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          isBlocked: true,
        },
      },
    },
  });
  if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now() || existing.user.isBlocked) {
    return null;
  }
  if (!hashesEqual(existing.deviceHash, presentedDeviceHash)) {
    logSecurityEvent("auth.refresh.device_mismatch");
    return null;
  }
  if (!hashesEqual(existing.refreshHash, presentedHash)) {
    await revokeAllAuthSessions(existing.userId, "refresh_reuse");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }

  // A stored staff role can only stay the same or move down to USER. Persisting
  // that downgrade prevents a later DB promotion from silently restoring staff mode.
  const role: UserRole =
    (existing.role === "FOUNDER" || existing.role === "ADMIN" || existing.role === "MANAGER") &&
    existing.role === existing.user.role
      ? existing.role
      : "USER";
  const nextSecret = randomBytes(32).toString("base64url");
  const rotated = await prisma.authSession.updateMany({
    where: { id: existing.id, refreshHash: presentedHash, revokedAt: null },
    data: { refreshHash: hashRefreshSecret(nextSecret), lastUsedAt: new Date(), role },
  });
  if (rotated.count !== 1) {
    await revokeAllAuthSessions(existing.userId, "refresh_race");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }
  await writeRefreshCookies(existing.id, nextSecret, deviceId, existing.expiresAt);
  return {
    sessionId: existing.id,
    deviceHash: existing.deviceHash,
    role,
    user: {
      id: existing.user.id,
      email: existing.user.email,
      firstName: existing.user.firstName,
      lastName: existing.user.lastName,
      avatar: localAvatarPath(existing.user.avatar),
    },
  };
}

/** Revalidated on every Node auth() call, so revocation does not wait for JWT expiry. */
export async function authSessionIsActive(sessionId: string, deviceHash: string): Promise<boolean> {
  if (!prisma || !validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return false;
  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { deviceHash: true },
  });
  return Boolean(session && hashesEqual(session.deviceHash, deviceHash));
}

/** Persists a discovered demotion without ever promoting an existing session. */
export async function downgradeAuthSession(sessionId: string, deviceHash: string): Promise<void> {
  if (!prisma || !validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return;
  await prisma.authSession.updateMany({
    where: { id: sessionId, deviceHash, revokedAt: null, role: { not: "USER" } },
    data: { role: "USER" },
  });
}

export async function revokeAllAuthSessions(userId: string, reason: string): Promise<void> {
  if (!prisma) return;
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason.slice(0, 64) },
  });
}

export async function revokeOtherAuthSessions(userId: string, reason: string): Promise<void> {
  if (!prisma) return;
  const { refreshToken } = await readRefreshCookies();
  const current = parseRefreshToken(refreshToken);
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(current ? { id: { not: current.id } } : {}),
    },
    data: { revokedAt: new Date(), revokeReason: reason.slice(0, 64) },
  });
}

export async function revokeCurrentAuthSession(reason = "logout"): Promise<void> {
  if (!prisma) return;
  const { refreshToken, deviceId } = await readRefreshCookies();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed || !validRandomPart(deviceId)) return;
  await prisma.authSession.updateMany({
    where: { id: parsed.id, deviceHash: hashDevice(deviceId), revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}
