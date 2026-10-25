import { createHash } from "node:crypto";

import { logServerError } from "@/lib/security-log";

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
  /** Attempts in the current fixed window, used for bounded progressive delays. */
  attempts: number;
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
    return { allowed: true, retryAfterSeconds: 0, attempts: 1 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
      attempts: current.count,
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, attempts: current.count };
}

const SHARED_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if current == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

/**
 * Shared fixed-window limiting when Upstash REST credentials are configured.
 * The script increments and sets expiry atomically. A backend outage falls back
 * to the bounded local limiter so visitors are not locked out of the site.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) return checkRateLimit(key, limit, windowMs);

  try {
    if (!url || !token) throw new Error("Incomplete shared rate-limit configuration");
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
      throw new Error("Unsafe shared rate-limit endpoint");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        SHARED_LIMIT_SCRIPT,
        "1",
        `pip:rate-limit:${key}`,
        String(Math.max(1, Math.round(windowMs))),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error("Shared rate limiter rejected the request");
    const payload = (await response.json()) as { result?: unknown };
    const result = payload.result;
    const count = Array.isArray(result) ? Number(result[0]) : NaN;
    const ttl = Array.isArray(result) ? Number(result[1]) : NaN;
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      throw new Error("Invalid shared rate-limit response");
    }
    return count <= limit
      ? { allowed: true, retryAfterSeconds: 0, attempts: count }
      : {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, ttl) / 1000)),
          attempts: count,
        };
  } catch (error) {
    // Never log the REST URL, token or provider message. Keep the local safety net operational.
    logServerError("rate_limit.shared_unavailable", error);
    return checkRateLimit(key, limit, windowMs);
  }
}

export function retryAfterHeaders(retryAfterSeconds: number): Record<string, string> {
  return { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) };
}

/** Bounded delay before bcrypt: 250 ms from attempt three, capped at two seconds. */
export function progressiveLoginDelayMs(attempts: number): number {
  if (!Number.isFinite(attempts) || attempts < 3) return 0;
  return Math.min(2_000, 250 * 2 ** Math.min(3, Math.floor(attempts) - 3));
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
