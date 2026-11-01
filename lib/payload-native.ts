import type { Client, InValue } from "@libsql/client";
import { getPayload, type Payload, type PayloadRequest } from "payload";

import config from "@payload-config";

let payloadPromise: Promise<Payload> | null = null;

/** Единый native Payload Local API client для публичных и staff workflows. */
export function getPayloadClient(): Promise<Payload> {
  payloadPromise ??= getPayload({ config });
  return payloadPromise;
}

export type PayloadTransactionRequest = PayloadRequest;

// SQLite has one writer. Holding a per-client turn until commit/rollback also
// avoids libSQL's failed concurrent BEGIN paths retaining native connections.
const transactionTails = new WeakMap<Payload, Promise<void>>();

async function acquireTransactionTurn(payload: Payload): Promise<() => void> {
  const previous = transactionTails.get(payload) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  transactionTails.set(payload, tail);
  await previous;
  return () => {
    release();
    if (transactionTails.get(payload) === tail) transactionTails.delete(payload);
  };
}

/** Все записи заказа и его дочерних документов коммитятся одной SQLite transaction. */
function isSqliteBusy(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const code = String(candidate?.code ?? candidate?.cause?.code ?? "").toUpperCase();
  const message = `${String(candidate?.message ?? "")} ${String(candidate?.cause?.message ?? "")}`.toLowerCase();
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" || message.includes("database is locked");
}

export async function withPayloadTransaction<T>(
  payload: Payload,
  callback: (req: PayloadTransactionRequest) => Promise<T>,
): Promise<T> {
  const release = await acquireTransactionTurn(payload);
  try {
    let transactionID: string | undefined;
    // BEGIN IMMEDIATE can return SQLITE_BUSY before libSQL's busyTimeout applies.
    // Retry only the begin, never the callback with its domain side effects.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const started = await payload.db.beginTransaction();
        transactionID = started === null || started === undefined ? undefined : String(started);
        break;
      } catch (error) {
        if (!isSqliteBusy(error) || attempt === 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(10 * 2 ** attempt, 160)));
      }
    }
    if (!transactionID) throw new Error("Payload SQLite transactions are not configured.");
    const req = { payload, context: {}, transactionID } as PayloadRequest;
    try {
      const result = await callback(req);
      await payload.db.commitTransaction(transactionID);
      return result;
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID).catch(() => undefined);
      throw error;
    }
  } finally {
    release();
  }
}

export function payloadId(value: unknown): string | null {
  if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id);
  return value === null || value === undefined || value === "" ? null : String(value);
}

export function payloadDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPayloadUniqueError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { message?: unknown } } | null;
  const code = String(candidate?.code ?? "").toUpperCase();
  const message = `${String(candidate?.message ?? "")} ${String(candidate?.cause?.message ?? "")}`.toLowerCase();
  return code === "PAYLOAD_UNIQUE_CONSTRAINT" || code.includes("SQLITE_CONSTRAINT") || message.includes("unique") || message.includes("duplicate");
}

/** Низкоуровневые агрегаты и health-check используют тот же native Payload adapter. */
export async function queryPayloadRows<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const payload = await getPayloadClient();
  const client = (payload.db as unknown as { client: Client }).client;
  const result = await client.execute({
    sql,
    args: args.map((value) => value instanceof Date ? value.toISOString() : value) as InValue[],
  });
  return result.rows as T[];
}

/** Скрипты корректно освобождают libSQL connection после завершения работы. */
export async function closePayloadClient(): Promise<void> {
  if (!payloadPromise) return;
  const payload = await payloadPromise;
  const client = (payload.db as unknown as { client?: { close?: () => void | Promise<void> } }).client;
  try {
    // Payload's drizzle destroy only resets metadata and creates a new pending
    // initialization promise. This client is being discarded, so close the
    // underlying libSQL connection directly instead of reinitializing it.
    await client?.close?.();
  } finally {
    payloadPromise = null;
  }
}
