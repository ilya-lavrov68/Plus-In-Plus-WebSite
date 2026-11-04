import { randomUUID } from "node:crypto";

import { rows, run } from "@/lib/db";
import { normalizeRole, type UserRole } from "@/lib/user-profile";

/**
 * Аккаунты и MFA-таблицы читаются и пишутся напрямую в SQLite.
 *
 * Раньше это делал Payload Local API: он же приводил snake_case-колонки к
 * camelCase-полям, проверял уникальность e-mail и каскадно удалял связи.
 * Здесь это делается явно: один SELECT со списком колонок, один маппер и
 * whitelist полей на запись — никаких «магических» путей в обход guards.
 */

/** Исполнитель запросов: глобальное соединение или активная транзакция. */
export interface SqlExecutor {
  rows<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<T[]>;
  run(sql: string, args?: unknown[]): Promise<number>;
}

const direct: SqlExecutor = { rows, run };

const ACCOUNT_COLUMNS = `id, email, password_hash, first_name, last_name, role, is_blocked,
  avatar, avatar_media_id, mfa_secret, mfa_pending_secret, mfa_pending_created_at,
  mfa_enabled_at, web_authn_registration_challenge, web_authn_registration_challenge_exp,
  created_at, updated_at`;

const PASSKEY_COLUMNS = "id, user_id_id, public_key, counter, transports, name, last_used_at, created_at";

export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isBlocked: boolean;
  avatar: string | null;
  avatarMediaId: string | null;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
  mfaPendingCreatedAt: Date | null;
  mfaEnabledAt: Date | null;
  webAuthnRegistrationChallenge: string | null;
  webAuthnRegistrationChallengeExp: Date | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PasskeyRecord {
  id: string;
  userId: string;
  publicKey: string;
  counter: string;
  transports: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string | null;
}

export interface AccountWithPasskeys extends AccountRecord {
  webAuthnCredentials: PasskeyRecord[];
}

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function flag(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function date(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapAccount(source: Row): AccountRecord {
  return {
    id: String(source.id),
    email: String(source.email ?? ""),
    passwordHash: text(source.password_hash),
    firstName: text(source.first_name),
    lastName: text(source.last_name),
    role: normalizeRole(text(source.role)),
    isBlocked: flag(source.is_blocked),
    avatar: text(source.avatar),
    avatarMediaId: text(source.avatar_media_id),
    mfaSecret: text(source.mfa_secret),
    mfaPendingSecret: text(source.mfa_pending_secret),
    mfaPendingCreatedAt: date(source.mfa_pending_created_at),
    mfaEnabledAt: date(source.mfa_enabled_at),
    webAuthnRegistrationChallenge: text(source.web_authn_registration_challenge),
    webAuthnRegistrationChallengeExp: date(source.web_authn_registration_challenge_exp),
    createdAt: text(source.created_at),
    updatedAt: text(source.updated_at),
  };
}

export function mapPasskey(source: Row): PasskeyRecord {
  return {
    id: String(source.id),
    userId: String(source.user_id_id ?? ""),
    publicKey: String(source.public_key ?? ""),
    counter: String(source.counter ?? "0"),
    transports: String(source.transports ?? "[]"),
    name: String(source.name ?? "Passkey"),
    lastUsedAt: text(source.last_used_at),
    createdAt: text(source.created_at),
  };
}

export async function findAccountById(id: string, exec: SqlExecutor = direct): Promise<AccountRecord | null> {
  const found = await exec.rows(`select ${ACCOUNT_COLUMNS} from accounts where id = ? limit 1`, [id]);
  return found[0] ? mapAccount(found[0]) : null;
}

/** E-mail хранится в нижнем регистре, но сравнение остаётся нечувствительным к регистру для старых строк. */
export async function findAccountByEmail(email: string, exec: SqlExecutor = direct): Promise<AccountRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const found = await exec.rows(`select ${ACCOUNT_COLUMNS} from accounts where lower(email) = ? limit 1`, [normalized]);
  return found[0] ? mapAccount(found[0]) : null;
}

export async function listPasskeys(userId: string, exec: SqlExecutor = direct): Promise<PasskeyRecord[]> {
  const found = await exec.rows(`select ${PASSKEY_COLUMNS} from webauthn_credentials where user_id_id = ? order by created_at`, [userId]);
  return found.map(mapPasskey);
}

export async function findPasskeyForUser(userId: string, credentialId: string, exec: SqlExecutor = direct): Promise<PasskeyRecord | null> {
  const found = await exec.rows(
    `select ${PASSKEY_COLUMNS} from webauthn_credentials where id = ? and user_id_id = ? limit 1`,
    [credentialId, userId],
  );
  return found[0] ? mapPasskey(found[0]) : null;
}

/** Аккаунт со списком passkey — форма, которую ожидают auth-сценарии. */
export async function withPasskeys(account: AccountRecord, exec: SqlExecutor = direct): Promise<AccountWithPasskeys> {
  return { ...account, webAuthnCredentials: await listPasskeys(account.id, exec) };
}

export async function findAccountWithPasskeysByEmail(email: string, exec: SqlExecutor = direct): Promise<AccountWithPasskeys | null> {
  const account = await findAccountByEmail(email, exec);
  return account ? withPasskeys(account, exec) : null;
}

export async function findAccountWithPasskeysById(id: string, exec: SqlExecutor = direct): Promise<AccountWithPasskeys | null> {
  const account = await findAccountById(id, exec);
  return account ? withPasskeys(account, exec) : null;
}

/** Whitelist колонок: неизвестный ключ игнорируется, а не превращается в SQL. */
const ACCOUNT_FIELDS = {
  email: "email",
  passwordHash: "password_hash",
  firstName: "first_name",
  lastName: "last_name",
  role: "role",
  isBlocked: "is_blocked",
  avatar: "avatar",
  avatarMediaId: "avatar_media_id",
  mfaSecret: "mfa_secret",
  mfaPendingSecret: "mfa_pending_secret",
  mfaPendingCreatedAt: "mfa_pending_created_at",
  mfaEnabledAt: "mfa_enabled_at",
  webAuthnRegistrationChallenge: "web_authn_registration_challenge",
  webAuthnRegistrationChallengeExp: "web_authn_registration_challenge_exp",
} as const;

export type AccountPatch = Partial<{
  [K in keyof typeof ACCOUNT_FIELDS]: AccountRecord[K] | string | null | undefined;
}>;

function fieldValue(key: string, value: unknown): unknown {
  if (key === "isBlocked") return value ? 1 : 0;
  if (key === "mfaPendingCreatedAt" || key === "mfaEnabledAt" || key === "webAuthnRegistrationChallengeExp") {
    return value instanceof Date ? value.toISOString() : value ?? null;
  }
  return value ?? null;
}

export async function updateAccount(id: string, patch: AccountPatch, exec: SqlExecutor = direct): Promise<void> {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(ACCOUNT_FIELDS)) {
    if (!(key in patch)) continue;
    assignments.push(`${column} = ?`);
    params.push(fieldValue(key, patch[key as keyof AccountPatch]));
  }
  if (!assignments.length) return;
  assignments.push("updated_at = ?");
  params.push(new Date().toISOString(), id);
  await exec.run(`update accounts set ${assignments.join(", ")} where id = ?`, params);
}

export interface NewAccount {
  email: string;
  passwordHash: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: UserRole;
  avatar?: string | null;
}

export async function createAccount(input: NewAccount, exec: SqlExecutor = direct): Promise<AccountRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await exec.run(
    `insert into accounts (id, email, password_hash, first_name, last_name, role, is_blocked, avatar, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.email.trim().toLowerCase(),
      input.passwordHash,
      input.firstName?.trim() || null,
      input.lastName?.trim() || null,
      normalizeRole(input.role),
      input.avatar ?? null,
      now,
      now,
    ],
  );
  const created = await findAccountById(id, exec);
  if (!created) throw new Error("Account row disappeared right after insert.");
  return created;
}

export interface NewPasskey {
  id: string;
  userId: string;
  publicKey: string;
  counter: string;
  transports: string;
  name: string;
}

export async function insertPasskey(input: NewPasskey, exec: SqlExecutor = direct): Promise<void> {
  const now = new Date().toISOString();
  await exec.run(
    `insert into webauthn_credentials (id, user_id_id, public_key, counter, transports, name, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.userId, input.publicKey, input.counter, input.transports, input.name, now, now],
  );
}

export async function updatePasskeyCounter(id: string, counter: string, exec: SqlExecutor = direct): Promise<void> {
  const now = new Date().toISOString();
  await exec.run(
    `update webauthn_credentials set counter = ?, last_used_at = ?, updated_at = ? where id = ?`,
    [counter, now, now, id],
  );
}

export async function deletePasskey(userId: string, credentialId: string, exec: SqlExecutor = direct): Promise<number> {
  return exec.run(`delete from webauthn_credentials where id = ? and user_id_id = ?`, [credentialId, userId]);
}

export async function deleteAllBackupCodes(userId: string, exec: SqlExecutor = direct): Promise<void> {
  await exec.run(`delete from mfa_backup_codes where user_id_id = ?`, [userId]);
}

export async function replaceBackupCodes(userId: string, hashes: readonly string[], exec: SqlExecutor = direct): Promise<void> {
  await deleteAllBackupCodes(userId, exec);
  const now = new Date().toISOString();
  for (const codeHash of hashes) {
    await exec.run(
      `insert into mfa_backup_codes (id, user_id_id, code_hash, created_at, updated_at) values (?, ?, ?, ?, ?)`,
      [randomUUID(), userId, codeHash, now, now],
    );
  }
}

/** Одноразовое списание backup-кода: условный UPDATE защищает от гонки. */
export async function consumeBackupCode(userId: string, codeHash: string, exec: SqlExecutor = direct): Promise<boolean> {
  const now = new Date().toISOString();
  const affected = await exec.run(
    `update mfa_backup_codes set used_at = ?, updated_at = ?
     where user_id_id = ? and code_hash = ? and used_at is null`,
    [now, now, userId, codeHash],
  );
  return affected === 1;
}

export async function countBackupCodes(userId: string, exec: SqlExecutor = direct): Promise<number> {
  const found = await exec.rows<{ total: number }>(
    `select count(*) as total from mfa_backup_codes where user_id_id = ? and used_at is null`,
    [userId],
  );
  return Number(found[0]?.total ?? 0);
}

export interface ActivityEntry {
  action: string;
  entityType: "user" | "order" | "service" | "post" | "setting" | "media";
  entityId: string;
  title: string;
  actorId: string | null;
}

/** Журнал действий: одна параметризованная вставка, транзакция наследуется. */
export async function recordActivity(entry: ActivityEntry, exec: SqlExecutor = direct): Promise<void> {
  const now = new Date().toISOString();
  await exec.run(
    `insert into activity_logs (id, action, entity_type, entity_id, title, actor_id_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), entry.action, entry.entityType, entry.entityId, entry.title, entry.actorId, now, now],
  );
}

export async function activityForUser(userId: string, limit = 20): Promise<ActivityEntry[]> {
  const away = Math.min(Math.max(1, limit), 100);
  const found = await rows(
    `select action, entity_type, entity_id, title, actor_id_id from activity_logs
     where entity_type = 'user' and entity_id = ? order by created_at desc limit ?`,
    [userId, away],
  );
  return found.map((item) => ({
    action: String(item.action ?? ""),
    entityType: "user" as const,
    entityId: String(item.entity_id ?? ""),
    title: String(item.title ?? ""),
    actorId: text(item.actor_id_id),
  }));
}

/** SQLite уникальность (в том числе e-mail) приходит одним кодом ошибки. */
export function isUniqueConstraintError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const code = String(candidate?.code ?? candidate?.cause?.code ?? "").toUpperCase();
  const message = `${String(candidate?.message ?? "")} ${String(candidate?.cause?.message ?? "")}`.toLowerCase();
  return code.includes("SQLITE_CONSTRAINT") || code === "SQLITE_CONSTRAINT_UNIQUE" || message.includes("unique");
}
