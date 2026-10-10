import { createHash } from "node:crypto";

interface Bucket {
  count: number;
  expiresAt: number;
}

const MAX_BUCKETS = 20_000;
const globalRateLimits = globalThis as typeof globalThis & {
  __pipRateLimits?: Map<string, Bucket>;
};
const buckets = globalRateLimits.__pipRateLimits ??= new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Process-local throttling. Use a CDN/WAF for distributed production limits. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = buckets.get(key);

  if (!current || current.expiresAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.expiresAt <= now) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) buckets.delete(oldestKey);
      }
    }

    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Hash identifiers before retaining them in the in-process limiter map. */
export function hashRateLimitIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Uses proxy-provided IP headers; configure the trusted proxy to overwrite them. */
export function getClientAddress(value: string | string[] | null | undefined): string {
  const header = Array.isArray(value) ? value[0] : value;
  const address = header?.split(",", 1)[0]?.trim();
  return address && address.length <= 128 ? address : "unknown";
}
