import { run } from "@/lib/db";

/**
 * Отзыв refresh-сессий без привязки к запросу.
 *
 * Модуль не импортирует `next/headers`, поэтому его можно звать из CLI
 * (`npm run db:promote-admin`) и скриптов: там нет cookie-контекста, и
 * импорт request-модуля ронял скрипт на `ERR_MODULE_NOT_FOUND`.
 */

export async function revokeWhere(
  userId: string,
  now: string,
  reason: string,
  excludeSessionId?: string,
): Promise<void> {
  const params: unknown[] = [now, reason.slice(0, 64), now, userId];
  let sql =
    "update auth_sessions set revoked_at = ?, revoke_reason = ?, updated_at = ? where user_id_id = ? and revoked_at is null";
  if (excludeSessionId) {
    sql += " and id <> ?";
    params.push(excludeSessionId);
  }
  await run(sql, params);
}

/** Смена роли или блокировка: живых сессий у аккаунта остаться не должно. */
export async function revokeAllAuthSessions(userId: string, reason: string): Promise<void> {
  await revokeWhere(userId, new Date().toISOString(), reason);
}
