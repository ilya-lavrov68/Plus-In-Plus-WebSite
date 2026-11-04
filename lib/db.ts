import { createClient, type Client, type InValue } from "@libsql/client";

import { ensureLocalDatabaseDirectory } from "./database";

/**
 * Собственный доступ к SQLite/libSQL. Единственная точка соединения для
 * приложения: и публичный сайт, и админка, и админ-аналитика ходят в базу
 * напрямую, без CMS-слоя.
 *
 * URL берётся из `DATABASE_URL`, legacy-имя `PAYLOAD_DATABASE_URL` поддерживается
 * как алиас, чтобы существующие .env и скрипты продолжали работать.
 */

const DEFAULT_DATABASE_URL = "file:./data/pip.db";

function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.PAYLOAD_DATABASE_URL || DEFAULT_DATABASE_URL;
}

let client: Client | null = null;
let clientUrl = "";

export function getDb(): Client {
  const url = databaseUrl();
  if (!client || clientUrl !== url) {
    // Файловой базе нужен существующий каталог — на свежем клоне его нет.
    ensureLocalDatabaseDirectory(url);
    client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || process.env.PAYLOAD_DATABASE_AUTH_TOKEN || undefined,
    });
    clientUrl = url;
  }
  return client;
}

function toArgs(args: unknown[]): InValue[] {
  return args.map((value) => {
    if (value instanceof Date) return value.toISOString();
    if (value === undefined) return null;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
    if (value instanceof Uint8Array) return value;
    return JSON.stringify(value);
  }) as InValue[];
}

/** Чтение: всегда параметризованный SQL, строки возвращаются как есть. */
export async function rows<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const result = await getDb().execute({ sql, args: toArgs(args) });
  return result.rows as T[];
}

export async function row<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T | null> {
  const result = await rows<T>(sql, args);
  return result[0] ?? null;
}

/** Запись: возвращает число затронутых строк. */
export async function run(sql: string, args: unknown[] = []): Promise<number> {
  const result = await getDb().execute({ sql, args: toArgs(args) });
  return result.rowsAffected;
}

export interface DbTransaction {
  rows<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<T[]>;
  run(sql: string, args?: unknown[]): Promise<number>;
}

/** Всё, что умеет читать и писать: соединение напрямую или транзакция. */
export type SqlExecutor = DbTransaction;

function isSqliteBusy(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const code = String(candidate?.code ?? candidate?.cause?.code ?? "").toUpperCase();
  const message = `${String(candidate?.message ?? "")} ${String(candidate?.cause?.message ?? "")}`.toLowerCase();
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" || message.includes("database is locked") || message.includes("database table is locked");
}

// В SQLite один писатель. Очередь держит транзакции этого процесса
// последовательными: параллельные BEGIN дают SQLITE_BUSY и оставляют
// незакрытые native-соединения.
let writerTail: Promise<void> = Promise.resolve();

async function acquireWriter(): Promise<() => void> {
  const previous = writerTail;
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  writerTail = previous.then(() => current);
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}

async function startWriteTransaction() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getDb().transaction("write");
    } catch (error) {
      if (!isSqliteBusy(error) || attempt >= 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10 * 2 ** attempt, 160)));
    }
  }
}

/**
 * Запись в одной SQLite-транзакции. Нужна там, где несколько изменений должны
 * примениться вместе: выдача сессии и вытеснение лишних, ротация refresh-токена,
 * создание заказа.
 */
export async function withTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const release = await acquireWriter();
  let tx;
  try {
    tx = await startWriteTransaction();
  } catch (error) {
    release();
    throw error;
  }
  const scoped: DbTransaction = {
    async rows<R = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<R[]> {
      const result = await tx.execute({ sql, args: toArgs(args) });
      return result.rows as R[];
    },
    async run(sql: string, args: unknown[] = []): Promise<number> {
      const result = await tx.execute({ sql, args: toArgs(args) });
      return result.rowsAffected;
    },
  };
  try {
    const result = await fn(scoped);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Соединение могло уже закрыться — исходная ошибка важнее.
    }
    throw error;
  } finally {
    release();
  }
}

/** Закрытие соединения для скриптов и тестов. */
export async function closeDb(): Promise<void> {
  try {
    await client?.close();
  } finally {
    client = null;
    clientUrl = "";
  }
}

export const sqlValue = {
  text: (value: unknown): string => (value == null ? "" : String(value)),
  number: (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },
  boolean: (value: unknown): boolean => value === 1 || value === true || value === "1",
  date: (value: unknown): Date | null => {
    if (value == null || value === "") return null;
    const parsed = typeof value === "number" ? new Date(value) : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  },
  json: (value: unknown, fallback: unknown): unknown => {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  },
};
