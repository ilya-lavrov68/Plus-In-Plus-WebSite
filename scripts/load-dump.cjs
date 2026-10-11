// Loads an SQL dump (e.g. a Turso production dump) into the configured database.
//
//   turso db shell plus-in-plus .dump > dump.sql
//   npm run db:load-dump -- dump.sql --replace
//
// Typical use: pull production data down for local work. The target defaults to the
// local file database, so nothing is overwritten remotely unless the production
// TURSO_DATABASE_URL is exported on purpose. No sqlite3 binary is required.
const fs = require("node:fs");
const path = require("node:path");
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const TABLES = ["activity_logs", "posts", "services", "users"];

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const replace = process.argv.includes("--replace");
  const dumpPath = path.resolve(args[0] ?? "dump.sql");

  if (!fs.existsSync(dumpPath)) {
    console.error(`[dump] File not found: ${dumpPath}`);
    console.error("[dump] Create one with: turso db shell <database> .dump > dump.sql");
    process.exit(1);
  }

  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) {
    console.error("[dump] No database target. Set TURSO_DATABASE_URL in .env (see .env.example).");
    process.exit(1);
  }

  const { createClient } = require("@libsql/client");
  const client = createClient({ url: config.url, authToken: config.authToken });
  console.log(`[dump] Source: ${path.basename(dumpPath)} (${(fs.statSync(dumpPath).size / 1024).toFixed(1)} kB)`);
  console.log(`[dump] Target: ${describeDatabaseUrl(config.url)} (${config.remote ? "REMOTE" : "local file"})`);

  try {
    let existing = 0;
    for (const table of TABLES) {
      const result = await client.execute(`select count(*) as total from "${table}"`).catch(() => ({ rows: [{ total: 0 }] }));
      existing += Number(result.rows[0]?.total ?? 0);
    }

    if (existing > 0 && !replace) {
      console.error(
        `[dump] The target already contains ${existing} row(s). Re-run with --replace to delete them first.\n` +
          "[dump] (--replace only clears the four application tables, never the schema.)",
      );
      process.exit(1);
    }

    if (config.remote && !process.argv.includes("--yes-remote")) {
      // Loading a dump over production data is almost always a mistake.
      console.error(
        "[dump] The target is a REMOTE database. Add --yes-remote if this is really intended\n" +
          "[dump] (it overwrites content). For local development, leave TURSO_DATABASE_URL unset.",
      );
      process.exit(1);
    }

    if (replace) {
      for (const table of TABLES) {
        await client.execute(`delete from "${table}"`).catch(() => {});
      }
      console.log("[dump] Target tables cleared.");
    }

    // executeMultiple runs the whole script; the dump's own BEGIN/COMMIT is kept.
    await client.executeMultiple(fs.readFileSync(dumpPath, "utf8"));

    console.log("[dump] Loaded. Row counts now:");
    for (const table of TABLES) {
      const result = await client.execute(`select count(*) as total from "${table}"`).catch(() => ({ rows: [{ total: "?" }] }));
      console.log(`[dump]   ${table.padEnd(14)} ${result.rows[0]?.total ?? "?"}`);
    }
    console.log("[dump] Verify the schema with `npm run db:check` (a dump may predate a schema change).");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`[dump] Failed: ${error.message}`);
  process.exit(1);
});
