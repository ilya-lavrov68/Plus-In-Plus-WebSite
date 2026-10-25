/**
 * Security headers built per request.
 *
 * The Content-Security-Policy needs a fresh nonce for every document, so it cannot live in
 * `next.config.mjs` `headers()` (those are static). It is assembled here — a pure, edge-safe
 * module with no imports — and applied by `middleware.ts`.
 *
 * What the site actually loads, and therefore what the policy allows:
 *   * scripts: only our own bundles, plus the inline `self.__next_f.push(…)` flight scripts
 *     that Next.js renders — Next.js copies the request's CSP nonce onto them;
 *   * styles: our Tailwind stylesheet plus `style="…"` attributes (React, TipTap);
 *   * images, fonts, fetches: same origin only (`/uploads/…`, `/images/…`, `/api/…`);
 *   * frames: only validated Canva design embeds; plugins and `<base>`: nothing.
 *
 * There are no third-party scripts, fonts or analytics on the site. Canva is the only external
 * frame host, while scripts, images and connections remain same-origin. `PIP_CSP=report-only`
 * sends the same policy as
 * `Content-Security-Policy-Report-Only` (observe without breaking). `PIP_CSP=off` is
 * accepted only for local development; production always sends a CSP header.
 */

export interface ContentSecurityPolicyOptions {
  /** Base64 nonce, unique per request. */
  nonce: string;
  production: boolean;
  /** Hosts allowed to frame the site — the development preview only. */
  frameAncestors?: string[];
  mode?: CspMode;
}

export type CspMode = "enforce" | "report-only" | "off";

export const CSP_HEADER = "content-security-policy";
export const CSP_REPORT_ONLY_HEADER = "content-security-policy-report-only";

/** Read once per request; Next.js inlines `process.env` for the middleware bundle. */
export function cspMode(value = process.env.PIP_CSP, production = false): CspMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "off" || normalized === "0" || normalized === "false") {
    return production ? "enforce" : "off";
  }
  if (normalized === "report-only" || normalized === "report") return "report-only";
  return "enforce";
}

/** Hosts that may embed the site in a frame: none in production, the dev preview otherwise. */
export function defaultFrameAncestors(production: boolean): string[] {
  return production ? ["'none'"] : ["'self'", "*.e2b.app"];
}

export function buildContentSecurityPolicy({
  nonce,
  production,
  frameAncestors: ancestors = defaultFrameAncestors(production),
}: Omit<ContentSecurityPolicyOptions, "mode">): string {
  const directives: string[] = [
    "default-src 'self'",
    // Next.js renders inline flight-data scripts and copies this nonce onto them.
    `script-src 'self' 'nonce-${nonce}'${production ? "" : " 'unsafe-eval'"}`,
    // `style="…"` attributes are used by React and the TipTap editor.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Same-origin API calls; the dev server additionally needs the HMR websocket.
    `connect-src 'self'${production ? "" : " ws:"}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src https://www.canva.com https://canva.com",
    `frame-ancestors ${ancestors.join(" ")}`,
  ];

  if (production) {
    // Every URL the site renders is already https in production.
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/** Response headers that do not depend on the request: everything except the CSP. */
export function staticSecurityHeaders(production: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // Disable the removed/legacy browser XSS auditor; nonce CSP is the real boundary.
    "X-XSS-Protection": "0",
    // Legacy browsers without CSP support; `frame-ancestors` covers the rest.
    ...(production
      ? {
          "X-Frame-Options": "DENY",
          // No `preload`: submitting the domain requires a separate all-subdomain review.
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        }
      : {}),
  };
}

/** The header name the policy must be sent in, or null when the CSP is switched off. */
export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "off") return null;
  return mode === "report-only" ? CSP_REPORT_ONLY_HEADER : CSP_HEADER;
}

/**
 * A nonce per request: 16 random bytes, base64. `crypto.getRandomValues` is what the Edge
 * runtime provides; `Buffer` is not available there.
 */
export function createNonce(randomValues: (array: Uint8Array) => Uint8Array | void = defaultRandomValues): string {
  const bytes = new Uint8Array(16);
  randomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function defaultRandomValues(array: Uint8Array): Uint8Array {
  return crypto.getRandomValues(array);
}
