import path from "node:path";

/**
 * One place that decides which libSQL database the app, the Payload CLI and the
 * helper scripts talk to.
 *
 * Supported URLs (see README → "Database"):
 *   - `libsql://<db>-<org>.turso.io` — Turso Cloud (production; needs TURSO_AUTH_TOKEN)
 *   - `http(s)://…`                  — a self-hosted libSQL/sqld server
 *   - `file:./db/dev.db`         — a local SQLite file, no server needed
 *   - `:memory:`                     — throwaway database, scripts only
 *
 * DATABASE_URL — каноническая переменная в обоих окружениях: dev и prod ходят
 * в одну и ту же схему из db/schema.sql. PAYLOAD_DATABASE_URL остаётся алиасом
 * для уже настроенных окружений.
 */

export const LOCAL_DATABASE_FILE = path.join("payload", "pip.db");

/** Turso Cloud / self-hosted sqld: reached over the network instead of the filesystem. */
const REMOTE_PROTOCOL = /^(?:libsql|https?):/i;

export interface DatabaseConfig {
  /** libSQL connection string handed to @libsql/client. */
  url: string;
  /** Required by Turso Cloud, ignored by local files. */
  authToken?: string;
  /** True when the database is reached over the network. */
  remote: boolean;
}

export interface ResolveDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  /**
   * Local development always has a usable database: when nothing is configured the
   * app falls back to `db/dev.db`, so `npm run dev` never crashes with
   * "table does not exist" on a fresh clone. Production must fail closed instead.
   */
  allowDevelopmentFallback?: boolean;
}

export function localDatabaseUrl(rootDir: string = process.cwd()): string {
  return `file:${path.resolve(rootDir, LOCAL_DATABASE_FILE)}`;
}

export function isRemoteDatabaseUrl(url: string): boolean {
  return REMOTE_PROTOCOL.test(url.trim());
}

export function isSupportedDatabaseUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed === ":memory:" || isRemoteDatabaseUrl(trimmed) || trimmed.startsWith("file:");
}

/** `file:local.db` is relative to the process, not to db/schema.db. */
function normalizeFileUrl(url: string, rootDir: string): string {
  if (!url.startsWith("file:")) return url;
  const target = url.slice("file:".length);
  if (!target || target.startsWith("//") || path.isAbsolute(target)) return url;
  return `file:${path.resolve(rootDir, target)}`;
}

export function resolveDatabaseConfig(options: ResolveDatabaseOptions = {}): DatabaseConfig | null {
  const env = options.env ?? process.env;
  const rootDir = options.rootDir ?? process.cwd();
  const allowDevelopmentFallback =
    options.allowDevelopmentFallback ?? env.NODE_ENV !== "production";

  const authToken =
    env.DATABASE_AUTH_TOKEN?.trim() ||
    env.PAYLOAD_DATABASE_AUTH_TOKEN?.trim() ||
    env.TURSO_AUTH_TOKEN?.trim() ||
    undefined;
  const tursoUrl =
    env.DATABASE_URL?.trim() ||
    env.TURSO_DATABASE_URL?.trim() ||
    env.PAYLOAD_DATABASE_URL?.trim();
  if (tursoUrl) {
    if (!isSupportedDatabaseUrl(tursoUrl)) {
      throw new Error(
        `DATABASE_URL must start with "libsql:", "http(s):" or "file:" — got "${describeDatabaseUrl(tursoUrl)}".` +
          " The app runs on SQLite/libSQL only; see README → Database.",
      );
    }
    return {
      url: normalizeFileUrl(tursoUrl, rootDir),
      authToken,
      remote: isRemoteDatabaseUrl(tursoUrl),
    };
  }

  // Production fails closed: an empty configuration renders empty states and
  // disables sign-in instead of silently writing to a local file.
  if (!allowDevelopmentFallback) return null;

  return {
    url: localDatabaseUrl(rootDir),
    authToken: undefined,
    remote: false,
  };
}

/** Explains a `DATABASE_URL`/alias that this app cannot use (e.g. a PostgreSQL URL). */
export function unsupportedDatabaseUrlMessage(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of ["DATABASE_URL", "PAYLOAD_DATABASE_URL", "TURSO_DATABASE_URL"]) {
    const value = env[name]?.trim();
    if (value && !isSupportedDatabaseUrl(value)) {
      return (
        `${name} is set to "${describeDatabaseUrl(value)}", which is not a libSQL/SQLite URL. ` +
        `Set DATABASE_URL to a "file:" or "libsql:" URL (or remove ${name}). See README → Database.`
      );
    }
  }
  return null;
}

/** Safe for logs: keeps the host, hides credentials and query parameters. */
export function describeDatabaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "(empty)";
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "";
    }
    for (const key of [...parsed.searchParams.keys()]) parsed.searchParams.set(key, "***");
    return parsed.toString();
  } catch {
    return trimmed.replace(/[?#].*$/, "");
  }
}
