/**
 * Server-side fetches of addresses that a user typed in (SSRF guard).
 *
 * The admin "import source" preview is the only place where the server requests a URL chosen
 * by a person. Even for an administrator that must not become a way to reach the machine the
 * app runs on, the cloud metadata service (169.254.169.254) or anything else inside the
 * private network — a stolen admin session would otherwise be worth an internal scan.
 *
 * Rules: http/https only, ports 80/443 only, no credentials in the URL, no hostnames that
 * resolve to a loopback / private / link-local / reserved address, redirects re-validated hop
 * by hop, and the response body is capped.
 *
 * Node.js only — `node:dns` and `node:net` are not available in the Edge runtime or the browser.
 */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export class UnsafeTargetError extends Error {}

const ALLOWED_PORTS = new Set([80, 443]);
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_REDIRECTS = 3;

/** Names that mean "this machine" or "the internal network", whatever they resolve to. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "ip6-localhost",
  "ip6-loopback",
]);

const BLOCKED_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".lan",
  ".corp",
  ".home",
  ".intranet",
  ".localdomain",
];

/** Loopback, private, link-local, CGNAT, reserved, documentation and multicast ranges. */
const blockedRanges = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, includes the cloud metadata address
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard-only
  ["2001::", 32], // Teredo
  ["2001:2::", 48], // benchmarking
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["3ffe::", 16], // old 6bone
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv6");
}

/** True for any address that must never be requested from the server. */
export function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "").split("%", 1)[0];
  const family = isIP(normalized);
  // Not an address at all (or a decimal/hex IP literal): treat as forbidden and let the DNS
  // check in `assertPublicUrl` judge names, which resolve to a real family.
  if (!family) return true;
  try {
    // The family must be passed explicitly — BlockList defaults to "ipv4" and would let every
    // IPv6 address through. IPv4-mapped IPv6 (::ffff:127.0.0.1) matches the IPv4 rules.
    return blockedRanges.check(normalized, family === 6 ? "ipv6" : "ipv4");
  } catch {
    return true; // unparsable — treat as forbidden
  }
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().replace(/^\[|\]$/g, "").toLowerCase().replace(/\.+$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // An IP literal typed instead of a name is still an address.
  if (isIP(host) && isPrivateAddress(host)) return true;
  return false;
}

/**
 * Validates one URL. Throws `UnsafeTargetError` when it must not be requested.
 * DNS answers are checked too: a public-looking name may point at 127.0.0.1.
 */
export interface PublicTarget {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
}

export async function resolvePublicUrl(raw: string): Promise<PublicTarget> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeTargetError("The address could not be parsed.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeTargetError("Only http and https addresses are allowed.");
  }
  if (url.username || url.password) {
    throw new UnsafeTargetError("Addresses with embedded credentials are not allowed.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new UnsafeTargetError("Internal, loopback and service addresses are not allowed.");
  }

  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (!ALLOWED_PORTS.has(port)) {
    throw new UnsafeTargetError("Only the standard http and https ports are allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeTargetError("Internal, loopback and service addresses are not allowed.");
    }
    return { url, hostname, address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeTargetError("The address could not be resolved.");
  }
  if (records.length === 0) throw new UnsafeTargetError("The address could not be resolved.");
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new UnsafeTargetError("The address resolves to an internal network.");
    }
  }

  const selected = records[0];
  return {
    url,
    hostname,
    address: selected.address,
    family: selected.family === 6 ? 6 : 4,
  };
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  return (await resolvePublicUrl(raw)).url;
}

/** Reads at most `maxBytes`, so a hostile or huge page cannot exhaust memory. */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return (await response.text()).slice(0, maxBytes);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - total;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const joined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return joined.subarray(0, maxBytes).toString("utf8");
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  /** Test transport only; production callers use the DNS-pinned Undici fetch. */
  fetchImpl?: typeof fetch;
}

function pinnedAgent(target: PublicTarget): Agent {
  return new Agent({
    connect: {
      lookup: (hostname, _options, callback) => {
        const normalized = hostname.toLowerCase().replace(/\.$/, "");
        if (normalized !== target.hostname.toLowerCase()) {
          callback(new UnsafeTargetError("Unexpected connection hostname."), "");
          return;
        }
        // No second DNS answer is consulted: this connection must use the exact
        // public address validated by resolvePublicUrl().
        callback(null, target.address, target.family);
      },
    },
  });
}

/**
 * Fetches a public page as text. Every redirect is validated again, because a public address
 * may redirect to `http://169.254.169.254/…`.
 */
export async function fetchPublicText(target: string, options: SafeFetchOptions = {}): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let nextTarget = target;
  const fetchImpl = options.fetchImpl ?? (undiciFetch as unknown as typeof fetch);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const resolved = await resolvePublicUrl(nextTarget);
    const dispatcher = pinnedAgent(resolved);
    try {
      const response = await fetchImpl(resolved.url, {
        redirect: "manual",
        headers: { "user-agent": options.userAgent ?? "PlusInPlus import preview" },
        signal: AbortSignal.timeout(timeoutMs),
        dispatcher,
      } as RequestInit);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) throw new UnsafeTargetError("The address redirected without a destination.");
        nextTarget = new URL(location, resolved.url).toString();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new UnsafeTargetError(`The address answered ${response.status}.`);
      }
      return await readBodyCapped(response, maxBytes);
    } finally {
      await dispatcher.close().catch(() => undefined);
    }
  }

  throw new UnsafeTargetError("Too many redirects.");
}
