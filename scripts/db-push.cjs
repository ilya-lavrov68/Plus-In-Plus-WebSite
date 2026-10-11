// Synchronizes the libSQL/SQLite schema with prisma/schema.prisma.
//
//   npm run db:push                      → the database from .env (Turso in production)
//   npm run db:push -- --force-reset     → extra flags are forwarded to the Prisma CLI
//
// There are no migration files on purpose: `prisma db push` is idempotent, so the
// very same command works on an empty local file and on a Turso database. That is
// what removes the "table does not exist" class of failures between dev and prod.
//
// The script verifies the schema afterwards with the same structural check the dev
// server uses, so a silent failure cannot slip through.
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");
const { cliAvailable, generateClient, pushSchema, rootDir } = require("./lib/prisma-cli.cjs");

function fail(message) {
  console.error(`[db:push] ${message}`);
  process.exit(1);
}

async function main() {
  if (!cliAvailable()) fail("Prisma CLI is not installed. Run `npm install` first.");

  let resolveDatabaseConfig;
  let describeDatabaseUrl;
  try {
    ({ resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule());
  } catch (error) {
    fail(error.message);
    return;
  }

  // allowDevelopmentFallback keeps `npm run db:push` working on a fresh clone:
  // without .env it targets the local file prisma/dev.db instead of failing.
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) fail("No database target. Set TURSO_DATABASE_URL in .env (see .env.example).");
  if (config.remote && !config.authToken) {
    fail(
      `TURSO_AUTH_TOKEN is missing for the remote database ${describeDatabaseUrl(config.url)}. ` +
        "Create one with `turso db tokens create <database>`.",
    );
  }

  const env = { ...process.env, TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL?.trim() || config.url };
  console.log(`[db:push] Target: ${describeDatabaseUrl(config.url)} (${config.remote ? "Turso/libSQL over the network" : "local file"})`);

  const push = await pushSchema({ env });
  if (!push.ok) {
    fail(`prisma db push failed (exit code ${push.code ?? "unknown"}).`);
  }

  // The killed CLI may have been terminated before committing: verify and, if
  // anything is still missing, run the plain command and wait for it.
  let status = await checkSchema({ url: config.url, authToken: config.authToken, schemaPath: undefined });
  if (!status.ok && push.finished) {
    console.log("[db:push] Verifying with the full Prisma CLI (this can take up to a minute)…");
    const retry = await pushSchema({ env, useWatchdog: false });
    if (!retry.ok) fail(`prisma db push failed (exit code ${retry.code ?? "unknown"}).`);
    status = await checkSchema({ url: config.url, authToken: config.authToken, schemaPath: undefined });
  }

  if (!status.ok) {
    fail(
      `Schema still incomplete${status.missingTables.length ? ` — missing tables: ${status.missingTables.join(", ")}` : ""}` +
        `${status.missingColumns.length ? ` — missing columns: ${status.missingColumns.join(", ")}` : ""}.`,
    );
  }

  if (!generateClient({ env })) fail("prisma generate failed.");

  console.log("[db:push] Schema is in sync — all tables exist. Check with `npm run db:check`.");
}

main().catch((error) => {
  console.error(`[db:push] ${error.message}`);
  console.error(`[db:push] Working directory: ${rootDir}`);
  process.exit(1);
});
