import path from "node:path";

/**
 * One place that decides which libSQL database the app, the Prisma CLI and the
 * helper scripts talk to.
 *
 * Supported URLs (see README → "Database"):
 *   - `libsql://<db>-<org>.turso.io` — Turso Cloud (production; needs TURSO_AUTH_TOKEN)
 *   - `http(s)://…`                  — a self-hosted libSQL/sqld server
 *   - `file:./prisma/dev.db`         — a local SQLite file, no server needed
 *   - `:memory:`                     — throwaway database, scripts only
 *
 * TURSO_DATABASE_URL is the canonical variable in both environments — that is the
 * whole point of this setup: no dev/prod difference in code or schema.
 */

export const LOCAL_DATABASE_FILE = path.join("prisma", "dev.db");

/** Turso Cloud / self-hosted sqld: reached over the network instead of the filesystem. */
const REMOTE_PROTOCOL = /^(?:libsql|https?):/i;

export interface DatabaseConfig {
  /** libSQL connection string handed to @libsql/client. */
  url: string;
  /** Required by Turso Cloud, ignored by local files. */
  authToken?: string;
  /** True when the database is reached over the network. */
  remote: boolean;
  /** Set when the environment contained a DATABASE_URL this app can no longer use. */
  ignoredUrl?: string;
}

export interface ResolveDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  /**
   * Local development always has a usable database: when nothing is configured the
   * app falls back to `prisma/dev.db`, so `npm run dev` never crashes with
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

/** `file:local.db` is relative to the process, not to prisma/schema.prisma. */
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

  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;
  const tursoUrl = env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    if (!isSupportedDatabaseUrl(tursoUrl)) {
      throw new Error(
        `TURSO_DATABASE_URL must start with "libsql:", "http(s):" or "file:" — got "${describeDatabaseUrl(tursoUrl)}".` +
          " Turso/libSQL is not a PostgreSQL server; see README → Database.",
      );
    }
    return {
      url: normalizeFileUrl(tursoUrl, rootDir),
      authToken,
      remote: isRemoteDatabaseUrl(tursoUrl),
    };
  }

  // Legacy variable from the PostgreSQL setup: keep the app booting, but never
  // silently connect somewhere unexpected.
  const legacyUrl = env.DATABASE_URL?.trim();
  const ignoredUrl = legacyUrl && isSupportedDatabaseUrl(legacyUrl) ? undefined : legacyUrl;

  if (legacyUrl && !ignoredUrl) {
    const config: DatabaseConfig = {
      url: normalizeFileUrl(legacyUrl, rootDir),
      authToken,
      remote: isRemoteDatabaseUrl(legacyUrl),
    };
    return config;
  }

  // Production fails closed: an empty configuration renders empty states and
  // disables sign-in instead of silently writing to a local file.
  if (!allowDevelopmentFallback) return null;

  return {
    url: localDatabaseUrl(rootDir),
    authToken: undefined,
    remote: false,
    ignoredUrl,
  };
}

/** Explains a leftover `DATABASE_URL` that this app no longer understands. */
export function unsupportedDatabaseUrlMessage(env: NodeJS.ProcessEnv = process.env): string | null {
  const legacyUrl = env.DATABASE_URL?.trim();
  if (!legacyUrl || isSupportedDatabaseUrl(legacyUrl)) return null;
  return (
    `DATABASE_URL is set to "${describeDatabaseUrl(legacyUrl)}", which is not a libSQL/SQLite URL. ` +
    "The app now runs on Turso/libSQL — set TURSO_DATABASE_URL (or remove DATABASE_URL). See README → Database."
  );
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
