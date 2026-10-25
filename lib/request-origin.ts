/** Same-origin boundary for custom state-changing routes (Server Actions have their own). */
function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const direct = normalizedOrigin(request.url);
  if (direct) origins.add(direct);

  const host = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
    || new URL(request.url).protocol.replace(":", "");
  if (host && /^[A-Za-z0-9.:[\]-]+$/.test(host)) {
    const forwarded = normalizedOrigin(`${protocol}://${host}`);
    if (forwarded) origins.add(forwarded);
  }
  for (const configured of [process.env.AUTH_URL, process.env.NEXTAUTH_URL]) {
    if (!configured) continue;
    const origin = normalizedOrigin(configured);
    if (origin) origins.add(origin);
  }
  return origins;
}

/**
 * Origin is authoritative when present. Sec-Fetch-Site and Referer support older
 * browsers, but an absent origin on a cross-site fetch is never accepted.
 */
export function isSameOriginRequest(request: Request): boolean {
  const expected = requestOrigins(request);
  const origin = request.headers.get("origin");
  if (origin) {
    const actual = normalizedOrigin(origin);
    return Boolean(actual && expected.has(actual));
  }
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  const referer = request.headers.get("referer");
  if (referer) {
    const actual = normalizedOrigin(referer);
    return Boolean(actual && expected.has(actual));
  }
  return false;
}
