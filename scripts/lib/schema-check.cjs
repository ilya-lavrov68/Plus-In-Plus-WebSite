// Структурная проверка таблиц приложения (схема живёт в db/schema.sql).
// DDL здесь не выполняется — только чтение sqlite_master.
const EXPECTED_TABLES = [
  "accounts",
  "pending_logins",
  "auth_sessions",
  "mfa_backup_codes",
  "webauthn_credentials",
  "services",
  "products",
  "posts",
  "media",
  "orders",
  "order_services",
  "order_items",
  "payments",
  "activity_logs",
  "page_views",
  "site_settings",
  "story",
  "story_events",
];

async function inspectDatabase(url, authToken) {
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });
  try {
    const master = await client.execute("select name from sqlite_master where type = 'table'");
    return new Set(master.rows.map((row) => String(row.name)));
  } finally {
    client.close();
  }
}

async function checkSchema({ url, authToken }) {
  const tables = await inspectDatabase(url, authToken);
  const missingTables = EXPECTED_TABLES.filter((table) => !tables.has(table));
  return { ok: missingTables.length === 0, missingTables, missingColumns: [] };
}

module.exports = { EXPECTED_TABLES, checkSchema, inspectDatabase };
