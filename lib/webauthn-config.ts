import { headers } from "next/headers";

export interface WebAuthnConfig {
  rpID: string;
  origin: string;
}

function configuredOrigin(requestOrigin: string): string {
  const configured = process.env.WEBAUTHN_ORIGIN?.trim();
  const production = process.env.NODE_ENV === "production";
  if (production && !configured) {
    throw new Error("WEBAUTHN_ORIGIN is required for passkeys in production.");
  }
  const origin = new URL(configured || requestOrigin).origin;
  const parsed = new URL(origin);
  if (production && parsed.protocol !== "https:") {
    throw new Error("Passkeys require HTTPS in production.");
  }
  if (!production && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Unsupported WebAuthn origin.");
  }
  return origin;
}

/** Validates that an assertion can only be accepted for the intended site. */
export function resolveWebAuthnConfig(requestOrigin: string): WebAuthnConfig {
  const origin = configuredOrigin(requestOrigin);
  const production = process.env.NODE_ENV === "production";
  const configuredRpID = process.env.WEBAUTHN_RP_ID?.trim().toLowerCase();
  if (production && !configuredRpID) {
    throw new Error("WEBAUTHN_RP_ID is required for passkeys in production.");
  }
  const rpID = configuredRpID || new URL(origin).hostname.toLowerCase();
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(rpID) || rpID.includes("..")) {
    throw new Error("Invalid WEBAUTHN_RP_ID.");
  }
  const originHostname = new URL(origin).hostname.toLowerCase();
  if (originHostname !== rpID && !originHostname.endsWith(`.${rpID}`)) {
    throw new Error("WEBAUTHN_RP_ID must match the site hostname or its parent domain.");
  }
  return { rpID, origin };
}

export function webAuthnConfigFromRequest(request: Request): WebAuthnConfig {
  return resolveWebAuthnConfig(new URL(request.url).origin);
}

/** Server Actions do not receive a Request, so derive a development origin from proxy headers. */
export async function webAuthnConfigFromAction(): Promise<WebAuthnConfig> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    || requestHeaders.get("host")
    || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
    || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return resolveWebAuthnConfig(`${protocol}://${host}`);
}
