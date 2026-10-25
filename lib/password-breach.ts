import { createHash } from "node:crypto";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 3_000;

export type PasswordBreachStatus = "clear" | "compromised" | "unavailable";
export type PasswordBreachErrorCode = "compromised" | "unavailable";

/** A fixed, non-sensitive error: neither the password nor its digest is attached. */
export class CompromisedPasswordError extends Error {
  constructor(readonly code: PasswordBreachErrorCode) {
    super(code === "compromised" ? "Compromised password rejected." : "Password breach check unavailable.");
    this.name = "CompromisedPasswordError";
  }
}

/**
 * Have I Been Pwned k-anonymity check. Only the first five SHA-1 characters leave
 * the process; the password and the remaining digest never appear in the request.
 * SHA-1 is used here solely because it is HIBP's public range protocol, never for storage.
 */
export async function checkPasswordBreach(
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<PasswordBreachStatus> {
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const response = await fetcher(`${HIBP_RANGE_URL}${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "PlusInPlus-Password-Safety",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });
    if (!response.ok) return "unavailable";

    const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return "unavailable";
    let compromised = false;
    for (const line of lines) {
      const match = /^([0-9A-F]{35}):(\d+)$/i.exec(line.trim());
      if (!match) return "unavailable";
      if (match[1].toUpperCase() === suffix && Number(match[2]) > 0) compromised = true;
    }
    return compromised ? "compromised" : "clear";
  } catch {
    return "unavailable";
  }
}

/**
 * Enabled by default. Production fails closed unless PIP_HIBP_REQUIRED=0 is an
 * explicit availability decision; development/test may proceed during a HIBP outage.
 * Set PIP_HIBP_CHECK=0 only when an equivalent breached-password service is in place.
 */
export async function assertPasswordNotCompromised(password: string): Promise<void> {
  if (process.env.PIP_HIBP_CHECK === "0") return;

  const status = await checkPasswordBreach(password);
  if (status === "compromised") throw new CompromisedPasswordError("compromised");
  if (status === "clear") return;

  const requiredSetting = process.env.PIP_HIBP_REQUIRED;
  const required = requiredSetting === "0"
    ? false
    : requiredSetting === "1" || process.env.NODE_ENV === "production";
  if (required) throw new CompromisedPasswordError("unavailable");

  // Deliberately no password, hash, account or request data in this log entry.
  console.warn("Password breach check unavailable; proceeding under the non-production availability policy.");
}
