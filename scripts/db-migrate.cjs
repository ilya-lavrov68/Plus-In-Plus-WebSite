// Применяет db/schema.sql к базе из DATABASE_URL (или PAYLOAD_DATABASE_URL).
// Скрипт идемпотентен: повторный запуск ничего не ломает и не удаляет данные.
const fs = require("node:fs");
const path = require("node:path");

const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");

const SCHEMA_FILE = path.join(__dirname, "..", "db", "schema.sql");

function statements() {
  return fs
    .readFileSync(SCHEMA_FILE, "utf8")
    .split(/;\s*\n/)
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .map((statement) =>
      statement
        .replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")
        .replace(/^CREATE UNIQUE INDEX (?!IF NOT EXISTS)/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
        .replace(/^CREATE INDEX (?!IF NOT EXISTS)/i, "CREATE INDEX IF NOT EXISTS "),
    );
}

async function main() {
  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) throw new Error("Set DATABASE_URL (see .env.example).");

  const { createClient } = require("@libsql/client");
  const client = createClient({ url: config.url, authToken: config.authToken });
  console.log(`[db:migrate] ${describeDatabaseUrl(config.url)} (${config.remote ? "remote" : "local file"})`);
  try {
    const plan = statements();
    for (const statement of plan) await client.execute(statement);
    console.log(`[db:migrate] Applied ${plan.length} schema statement(s) from db/schema.sql.`);
    const status = await checkSchema(config);
    if (!status.ok) throw new Error(`Schema is still incomplete: ${status.missingTables.join(", ")}`);
    console.log("[db:migrate] Schema is up to date.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`[db:migrate] ${error.message}`);
  process.exit(1);
});
