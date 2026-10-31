import { getPayload, type Payload, type PayloadRequest } from "payload";

import config from "@payload-config";

let payloadPromise: Promise<Payload> | null = null;

/** Единый native Payload Local API client для публичных и staff workflows. */
export function getPayloadClient(): Promise<Payload> {
  payloadPromise ??= getPayload({ config });
  return payloadPromise;
}

export type PayloadTransactionRequest = PayloadRequest;

/** Все записи заказа и его дочерних документов коммитятся одной SQLite transaction. */
export async function withPayloadTransaction<T>(
  payload: Payload,
  callback: (req: PayloadTransactionRequest) => Promise<T>,
): Promise<T> {
  const transactionID = await payload.db.beginTransaction();
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
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = String(candidate?.code ?? "").toUpperCase();
  const message = String(candidate?.message ?? "").toLowerCase();
  return code === "PAYLOAD_UNIQUE_CONSTRAINT" || code.includes("SQLITE_CONSTRAINT") || message.includes("unique") || message.includes("duplicate");
}
