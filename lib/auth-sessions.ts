import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { row, rows, run, sqlValue, withTransaction } from "@/lib/db";
import { hashesEqual } from "@/lib/mfa";
import { logSecurityEvent } from "@/lib/security-log";
import { MAX_CONCURRENT_SESSIONS, REFRESH_PRESENT_COOKIE, REFRESH_SESSION_SECONDS } from "@/lib/session-policy";
import { localAvatarPath } from "@/lib/upload-policy";
import type { UserRole } from "@/lib/user-profile";

/**
 * Refresh-сессии: таблица `auth_sessions` читается и пишется напрямую.
 * Хеши токена и устройства сравниваются в приложении (`hashesEqual`), не в SQL,
 * поэтому запросы остаются параметризованными и без утечек секретов в план.
 */

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

async function revokeWhere(userId: string, now: string, reason: string, excludeSessionId?: string): Promise<void> {
  const params: unknown[] = [now, reason.slice(0, 64), now, userId];
  let sql = "update auth_sessions set revoked_at = ?, revoke_reason = ?, updated_at = ? where user_id_id = ? and revoked_at is null";
  if (excludeSessionId) {
    sql += " and id <> ?";
    params.push(excludeSessionId);
  }
  await run(sql, params);
}

export async function createAuthSession(userId: string, role: UserRole): Promise<{ sessionId: string; deviceHash: string }> {
  const jar = await cookies();
  const existingDevice = jar.get(deviceCookieName())?.value;
  const deviceId = validRandomPart(existingDevice) ? existingDevice : randomBytes(32).toString("base64url");
  const deviceHash = hashDevice(deviceId);
  const sessionId = randomBytes(24).toString("base64url");
  const refreshSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_SESSION_SECONDS * 1000);

  await withTransaction(async (tx) => {
    await tx.run(
      `insert into auth_sessions (id, user_id_id, refresh_hash, device_hash, role, last_used_at, expires_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, hashRefreshSecret(refreshSecret), deviceHash, role, now.toISOString(), expiresAt.toISOString(), now.toISOString(), now.toISOString()],
    );
    // Лимит одновременных сессий: лишние (самые старые по last_used_at) отзываем.
    const active = await tx.rows<{ id: string }>(
      `select id from auth_sessions
       where user_id_id = ? and revoked_at is null and expires_at > ?
       order by last_used_at desc`,
      [userId, now.toISOString()],
    );
    const excess = active.slice(MAX_CONCURRENT_SESSIONS).map((session) => session.id);
    if (excess.length) {
      await tx.run(
        `update auth_sessions set revoked_at = ?, revoke_reason = 'session_limit', updated_at = ?
         where id in (${excess.map(() => "?").join(", ")}) and revoked_at is null`,
        [now.toISOString(), now.toISOString(), ...excess],
      );
    }
  });

  try {
    await writeRefreshCookies(sessionId, refreshSecret, deviceId, expiresAt);
  } catch (error) {
    await run(
      `update auth_sessions set revoked_at = ?, revoke_reason = 'cookie_write_failed', updated_at = ?
       where id = ? and revoked_at is null`,
      [new Date().toISOString(), new Date().toISOString(), sessionId],
    );
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
  const presentedHash = hashRefreshSecret(parsed.secret);
  const presentedDeviceHash = hashDevice(deviceId);

  const existing = await row<Record<string, unknown>>(
    `select s.id, s.refresh_hash, s.device_hash, s.role, s.expires_at, s.revoked_at,
            a.id account_id, a.email, a.first_name, a.last_name, a.avatar, a.role account_role, a.is_blocked
     from auth_sessions s left join accounts a on a.id = s.user_id_id
     where s.id = ?`,
    [parsed.id],
  );
  if (!existing) return null;

  const expiresAt = sqlValue.date(existing.expires_at);
  const account = existing.account_id == null ? null : {
    id: sqlValue.text(existing.account_id),
    email: sqlValue.text(existing.email),
    firstName: existing.first_name == null ? null : sqlValue.text(existing.first_name),
    lastName: existing.last_name == null ? null : sqlValue.text(existing.last_name),
    avatar: existing.avatar == null ? null : sqlValue.text(existing.avatar),
    role: sqlValue.text(existing.account_role),
    isBlocked: sqlValue.boolean(existing.is_blocked),
  };
  if (existing.revoked_at || !expiresAt || expiresAt.getTime() <= Date.now() || !account || account.isBlocked) return null;

  if (!hashesEqual(sqlValue.text(existing.device_hash), presentedDeviceHash)) {
    logSecurityEvent("auth.refresh.device_mismatch");
    return null;
  }
  const userId = account.id;
  if (!hashesEqual(sqlValue.text(existing.refresh_hash), presentedHash)) {
    await revokeAllAuthSessions(userId, "refresh_reuse");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }

  const sessionRole = sqlValue.text(existing.role);
  const role: UserRole = (sessionRole === "FOUNDER" || sessionRole === "ADMIN" || sessionRole === "MANAGER") && sessionRole === account.role
    ? sessionRole
    : "USER";
  const nextSecret = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();

  // Условный update защищает от гонки: ротация засчитывается только один раз.
  const updated = await run(
    `update auth_sessions set refresh_hash = ?, last_used_at = ?, role = ?, updated_at = ?
     where id = ? and refresh_hash = ? and revoked_at is null`,
    [hashRefreshSecret(nextSecret), now, role, now, parsed.id, presentedHash],
  );
  if (updated !== 1) {
    await revokeAllAuthSessions(userId, "refresh_race");
    logSecurityEvent("auth.refresh.reuse_detected");
    return null;
  }

  await writeRefreshCookies(parsed.id, nextSecret, deviceId, expiresAt);
  return {
    sessionId: parsed.id,
    deviceHash: sqlValue.text(existing.device_hash),
    role,
    user: {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      avatar: localAvatarPath(account.avatar),
    },
  };
}

export async function authSessionIsActive(sessionId: string, deviceHash: string): Promise<boolean> {
  if (!validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return false;
  const session = await row<{ device_hash: string }>(
    `select device_hash from auth_sessions
     where id = ? and revoked_at is null and expires_at > ? limit 1`,
    [sessionId, new Date().toISOString()],
  );
  return Boolean(session && hashesEqual(session.device_hash, deviceHash));
}

export async function downgradeAuthSession(sessionId: string, deviceHash: string): Promise<void> {
  if (!validRandomPart(sessionId) || !/^[a-f0-9]{64}$/.test(deviceHash)) return;
  await run(
    `update auth_sessions set role = 'USER', updated_at = ?
     where id = ? and device_hash = ? and revoked_at is null and role <> 'USER'`,
    [new Date().toISOString(), sessionId, deviceHash],
  );
}

export async function revokeAllAuthSessions(userId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await revokeWhere(userId, now, reason);
}

export async function revokeOtherAuthSessions(userId: string, reason: string): Promise<void> {
  const { refreshToken } = await readRefreshCookies();
  const current = parseRefreshToken(refreshToken);
  const now = new Date().toISOString();
  await revokeWhere(userId, now, reason, current?.id);
}

export async function revokeCurrentAuthSession(reason = "logout"): Promise<void> {
  const { refreshToken, deviceId } = await readRefreshCookies();
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed || !validRandomPart(deviceId)) return;
  const now = new Date().toISOString();
  await run(
    `update auth_sessions set revoked_at = ?, revoke_reason = ?, updated_at = ?
     where id = ? and device_hash = ? and revoked_at is null`,
    [now, reason, now, parsed.id, hashDevice(deviceId)],
  );
}

/** Все активные сессии пользователя — для страницы безопасности в профиле. */
export async function listActiveAuthSessions(userId: string): Promise<Array<{ id: string; lastUsedAt: string; expiresAt: string }>> {
  const found = await rows<{ id: string; last_used_at: string; expires_at: string }>(
    `select id, last_used_at, expires_at from auth_sessions
     where user_id_id = ? and revoked_at is null and expires_at > ?
     order by last_used_at desc`,
    [userId, new Date().toISOString()],
  );
  return found.map((session) => ({ id: session.id, lastUsedAt: session.last_used_at, expiresAt: session.expires_at }));
}
