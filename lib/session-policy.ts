/** Edge-safe session constants. Secrets and database work stay in lib/auth-sessions.ts. */
export const ACCESS_SESSION_SECONDS = 15 * 60;
export const REFRESH_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const MAX_CONCURRENT_SESSIONS = 3;
export const REFRESH_PRESENT_COOKIE = "pip-refresh-present";
