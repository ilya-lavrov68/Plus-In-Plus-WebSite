import { PrismaLibSQL } from "@prisma/adapter-libsql";

import { describeDatabaseUrl, resolveDatabaseConfig, unsupportedDatabaseUrlMessage } from "@/lib/database";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma client for every environment.
 *
 * The connection details come from TURSO_DATABASE_URL:
 *   - production: `libsql://<db>-<org>.turso.io` + TURSO_AUTH_TOKEN (Turso Cloud)
 *   - development: the local SQLite file `prisma/dev.db` when nothing is configured,
 *     created by `npm run db:push` or the additive local sync before `npm run dev`.
 *
 * The libSQL driver adapter replaces the old PostgreSQL adapter, so the same code
 * path is exercised locally and in production.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient | null {
  let config;
  try {
    config = resolveDatabaseConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return null;
  }

  if (!config) {
    const message = unsupportedDatabaseUrlMessage();
    if (message) {
      console.error(message);
    } else {
      console.warn(
        "TURSO_DATABASE_URL is not set — data sections will render as empty. " +
          "Run `npm run db:push` after configuring .env (see README → Database).",
      );
    }
    return null;
  }

  if (config.ignoredUrl) {
    console.warn(unsupportedDatabaseUrlMessage() ?? `Ignoring DATABASE_URL=${config.ignoredUrl}`);
  }
  if (config.remote && !config.authToken) {
    console.warn(
      `TURSO_AUTH_TOKEN is not set — Turso will reject the connection to ${describeDatabaseUrl(config.url)}.`,
    );
  }

  return new PrismaClient({
    adapter: new PrismaLibSQL({ url: config.url, authToken: config.authToken }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma ?? undefined;
}
