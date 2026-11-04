export type SecurityEventName =
  | "auth.login.malformed"
  | "auth.login.failed"
  | "auth.login.rate_limited"
  | "auth.mfa.failed"
  | "auth.mfa.rate_limited"
  | "auth.mfa.setup_complete"
  | "auth.refresh.device_mismatch"
  | "auth.refresh.reuse_detected"
  | "auth.refresh.rate_limited"
  | "security.csp.violation";

const CSP_DIRECTIVES = new Set([
  "default-src", "script-src", "script-src-elem", "script-src-attr",
  "style-src", "style-src-elem", "style-src-attr", "img-src",
  "connect-src", "font-src", "media-src", "child-src", "worker-src", "manifest-src",
  "frame-src", "frame-ancestors", "form-action", "base-uri", "object-src",
  "require-trusted-types-for", "trusted-types",
]);

/** Fixed allowlisted fields only: never pass email, IP, passwords, tokens or URLs. */
export function logSecurityEvent(
  event: SecurityEventName,
  details: { staffMode?: boolean; directive?: string } = {},
): void {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "warning",
    event,
    staffMode: details.staffMode === true,
    ...(details.directive && CSP_DIRECTIVES.has(details.directive)
      ? { directive: details.directive }
      : {}),
  }));
}

/**
 * Operational error logging without provider messages/stacks, which can contain
 * query values or other personal data. A small allowlisted error code is retained.
 */
export type ServerErrorEventName =
  | "auth.audit.write_failed"
  | "auth.credentials.lookup_failed"
  | "auth.login.lookup_failed"
  | "auth.login.failed"
  | "auth.registration.failed"
  | "auth.profile.update_failed"
  | "auth.password.change_failed"
  | "auth.logout.session_lookup_failed"
  | "auth.logout.failed"
  | "auth.session.create_failed"
  | "auth.session.refresh_failed"
  | "auth.mfa.setup_failed"
  | "auth.mfa.verify_failed"
  | "auth.mfa.passkey_failed"
  | "admin.user.role_update_failed"
  | "admin.user.block_update_failed"
  | "admin.user.password_reset_failed"
  | "admin.settings.update_failed"
  | "admin.notifications.config_read_failed"
  | "admin.notifications.telegram_send_failed"
  | "admin.featured_post.update_failed"
  | "admin.upload_album_failed"
  | "cart.checkout_failed"
  | "cart.item_failed"
  | "health.check_failed"
  | "rate_limit.shared_unavailable";

export function logServerError(event: ServerErrorEventName, error: unknown): void {
  const rawCode = typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
  const code = typeof rawCode === "string" && /^[A-Z0-9_]{1,32}$/.test(rawCode)
    ? rawCode
    : undefined;
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    ...(code ? { code } : {}),
  }));
}
