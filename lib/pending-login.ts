import { createHash, randomBytes } from "node:crypto";

import { findAccountById, listPasskeys, type AccountWithPasskeys } from "@/lib/accounts";
import { row, run, withTransaction } from "@/lib/db";
import { hashesEqual } from "@/lib/mfa";
import { normalizeRole, type UserRole } from "@/lib/user-profile";

/**
 * Промежуточный вход (пароль верен, второй фактор ещё нет).
 *
 * Таблица `pending_logins` — единственный источник правды: секрет хранится
 * только как sha256, попытки считаются в SQL, а списание идёт условным DELETE,
 * поэтому один и тот же challenge нельзя использовать дважды даже при гонке.
 */

export const PENDING_LOGIN_SECONDS = 5 * 60;
export const MAX_PENDING_LOGIN_ATTEMPTS = 5;
const MAX_PENDING_LOGINS_PER_USER = 5;
const ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export interface PendingLoginRecord {
  id: string;
  userId: string;
  role: UserRole;
  secretHash: string;
  webAuthnChallenge: string | null;
  attempts: number;
  expiresAt: Date;
  user: AccountWithPasskeys;
}

export async function createPendingLogin(userId: string, role: UserRole): Promise<{ pendingLoginId: string; pendingLoginSecret: string }> {
  const pendingLoginId = randomBytes(24).toString("base64url");
  const pendingLoginSecret = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_LOGIN_SECONDS * 1000);

  await withTransaction(async (tx) => {
    // Просроченные записи этого пользователя больше не нужны.
    await tx.run(`delete from pending_logins where user_id_id = ? and expires_at <= ?`, [userId, now.toISOString()]);
    await tx.run(
      `insert into pending_logins (id, user_id_id, role, secret_hash, attempts, expires_at, created_at, updated_at)
       values (?, ?, ?, ?, 0, ?, ?, ?)`,
      [pendingLoginId, userId, role, hashSecret(pendingLoginSecret), expiresAt.toISOString(), now.toISOString(), now.toISOString()],
    );
    // Лимит: держим только самые свежие challenge'и пользователя.
    const recent = await tx.rows<{ id: string }>(
      `select id from pending_logins where user_id_id = ? order by created_at desc`,
      [userId],
    );
    const excess = recent.slice(MAX_PENDING_LOGINS_PER_USER).map((item) => item.id);
    if (excess.length) {
      await tx.run(
        `delete from pending_logins where id in (${excess.map(() => "?").join(", ")})`,
        excess,
      );
    }
  });

  return { pendingLoginId, pendingLoginSecret };
}

/** Возвращает null для любого некорректного, просроченного или чужого секрета. */
export async function readPendingLogin(pendingLoginId: unknown, pendingLoginSecret: unknown): Promise<PendingLoginRecord | null> {
  if (typeof pendingLoginId !== "string" || typeof pendingLoginSecret !== "string") return null;
  if (!ID_PATTERN.test(pendingLoginId) || !ID_PATTERN.test(pendingLoginSecret)) return null;

  const pending = await row(
    `select id, user_id_id, role, secret_hash, web_authn_challenge, attempts, expires_at
     from pending_logins where id = ? limit 1`,
    [pendingLoginId],
  );
  if (!pending) return null;

  const expiresAt = new Date(String(pending.expires_at ?? ""));
  const attempts = Number(pending.attempts ?? 0);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null;
  if (!Number.isFinite(attempts) || attempts >= MAX_PENDING_LOGIN_ATTEMPTS) return null;
  if (!hashesEqual(String(pending.secret_hash ?? ""), hashSecret(pendingLoginSecret))) return null;

  const account = await findAccountById(String(pending.user_id_id ?? ""));
  if (!account || account.isBlocked) return null;
  const user: AccountWithPasskeys = { ...account, webAuthnCredentials: await listPasskeys(account.id) };
  return {
    id: String(pending.id),
    userId: account.id,
    role: normalizeRole(pending.role === null ? null : String(pending.role)),
    secretHash: String(pending.secret_hash ?? ""),
    webAuthnChallenge: pending.web_authn_challenge === null || pending.web_authn_challenge === undefined ? null : String(pending.web_authn_challenge),
    attempts,
    expiresAt,
    user,
  };
}

export async function recordPendingLoginFailure(pendingLoginId: string): Promise<void> {
  await run(
    `update pending_logins set attempts = attempts + 1, updated_at = ?
     where id = ? and attempts < ?`,
    [new Date().toISOString(), pendingLoginId, MAX_PENDING_LOGIN_ATTEMPTS],
  );
}

/** Условный DELETE: одноразовость challenge'а обеспечивает сама база. */
export async function consumePendingLogin(pendingLoginId: string, secretHash: string): Promise<boolean> {
  const consumed = await run(`delete from pending_logins where id = ? and secret_hash = ?`, [pendingLoginId, secretHash]);
  return consumed === 1;
}

export async function savePendingWebAuthnChallenge(pendingLoginId: string, secretHash: string, challenge: string): Promise<boolean> {
  const now = new Date();
  const updated = await run(
    `update pending_logins set web_authn_challenge = ?, updated_at = ?
     where id = ? and secret_hash = ? and attempts < ? and expires_at > ?`,
    [challenge, now.toISOString(), pendingLoginId, secretHash, MAX_PENDING_LOGIN_ATTEMPTS, now.toISOString()],
  );
  return updated === 1;
}

export function pendingSecretHash(secret: string): string {
  return hashSecret(secret);
}
