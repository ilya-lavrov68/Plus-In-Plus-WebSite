export type SecurityEventName =
  | "auth.login.malformed"
  | "auth.login.failed"
  | "auth.login.rate_limited";

/** Fixed allowlisted fields only: never pass email, IP, passwords, tokens or URLs. */
export function logSecurityEvent(
  event: SecurityEventName,
  details: { staffMode?: boolean } = {},
): void {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "warning",
    event,
    staffMode: details.staffMode === true,
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
  | "admin.user.role_update_failed"
  | "admin.user.block_update_failed"
  | "admin.user.password_reset_failed"
  | "admin.settings.update_failed"
  | "admin.featured_post.update_failed"
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
