// Verifies that the configured database is reachable AND that the schema is
// applied — the exact failure that used to appear as "table does not exist".
//
//   npm run db:check
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema, parseSchema } = require("./lib/schema-check.cjs");

async function main() {
  let resolveDatabaseConfig;
  let describeDatabaseUrl;
  try {
    ({ resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule());
  } catch (error) {
    console.error(`[db:check] ${error.message}`);
    process.exit(1);
  }

  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) {
    console.error("[db:check] No database target. Set TURSO_DATABASE_URL in .env (see .env.example).");
    process.exit(1);
  }

  const { createClient } = require("@libsql/client");
  const client = createClient({ url: config.url, authToken: config.authToken });

  console.log(`[db:check] ${describeDatabaseUrl(config.url)} (${config.remote ? "remote" : "local file"})`);

  try {
    const version = await client.execute("select sqlite_version() as version");
    console.log(`[db:check] Connected — SQLite ${version.rows[0]?.version}.`);
  } catch (error) {
    console.error(`[db:check] Cannot connect: ${error.message}`);
    process.exit(1);
  }

  // Compared with prisma/schema.prisma, so a forgotten `db:push` cannot hide.
  const status = await checkSchema({ url: config.url, authToken: config.authToken, schemaPath: undefined });
  if (!status.ok) {
    if (status.missingTables.length) console.error(`[db:check] Missing tables: ${status.missingTables.join(", ")}`);
    if (status.missingColumns.length) console.error(`[db:check] Missing columns: ${status.missingColumns.join(", ")}`);
    console.error("[db:check] Run `npm run db:push` to create/update the schema.");
    process.exit(1);
  }

  for (const model of parseSchema()) {
    const count = await client.execute(`select count(*) as total from "${model.table}"`);
    console.log(`[db:check] ok  ${model.table.padEnd(14)} ${count.rows[0]?.total ?? 0} row(s)`);
  }
  console.log("[db:check] Schema is complete — every table and column from prisma/schema.prisma exists.");
}

main().catch((error) => {
  console.error(`[db:check] Failed: ${error.message}`);
  process.exit(1);
});
