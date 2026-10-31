// Проверяет подключение и таблицы Payload, ничего не изменяя в базе.
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { EXPECTED_TABLES, checkSchema } = require("./lib/schema-check.cjs");

async function main() {
  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) throw new Error("Set PAYLOAD_DATABASE_URL (see .env.example).");

  const { createClient } = require("@libsql/client");
  const client = createClient({ url: config.url, authToken: config.authToken });
  console.log(`[db:check] ${describeDatabaseUrl(config.url)} (${config.remote ? "remote" : "local file"})`);
  try {
    const version = await client.execute("select sqlite_version() as version");
    console.log(`[db:check] Connected — SQLite ${version.rows[0]?.version}.`);
    const status = await checkSchema(config);
    if (!status.ok) {
      throw new Error(`Missing Payload tables: ${status.missingTables.join(", ")}. Run npm run payload:migrate.`);
    }
    for (const table of EXPECTED_TABLES) {
      const count = await client.execute(`select count(*) as total from "${table}"`);
      console.log(`[db:check] ok  ${table.padEnd(24)} ${count.rows[0]?.total ?? 0} row(s)`);
    }
    console.log("[db:check] Payload schema is present. Review pending migrations with npm run payload -- migrate:status.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`[db:check] ${error.message}`);
  process.exit(1);
});
