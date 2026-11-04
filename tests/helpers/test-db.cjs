/**
 * Настоящая SQLite для тестов.
 *
 * Раньше тесты подменяли Payload Local API объектным двойником. Теперь
 * приложение общается с базой напрямую, поэтому честнее поднять временную
 * базу из `db/schema.sql`: тогда проверяются настоящие ограничения, транзакции
 * и уникальные индексы, а не их имитация.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createClient } = require("@libsql/client");

const SCHEMA_FILE = path.join(__dirname, "..", "..", "db", "schema.sql");

function schemaStatements() {
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
    .filter(Boolean);
}

/** Таблицы приложения в порядке, безопасном для `delete from`. */
const APP_TABLES = [
  "activity_logs",
  "auth_sessions",
  "mfa_backup_codes",
  "pending_logins",
  "webauthn_credentials",
  "order_items",
  "order_services",
  "payments",
  "orders",
  "page_views",
  "posts_rels",
  "posts",
  "services_includes",
  "services_shapes",
  "services_option_groups_options",
  "services_option_groups",
  "services",
  "products",
  "media",
  "accounts",
];

function createTestDatabase(prefix = "pip-test-") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(directory, "test.db");
  const url = `file:${file}`;
  // `lib/db.ts` читает переменные окружения при первом обращении.
  process.env.DATABASE_URL = url;
  process.env.PAYLOAD_DATABASE_URL = url;
  delete process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({ url });
  const ready = (async () => {
    for (const statement of schemaStatements()) await client.execute(statement);
  })();

  return {
    directory,
    file,
    url,
    ready,
    async exec(sql, args = []) {
      await ready;
      return client.execute({ sql, args });
    },
    async rows(sql, args = []) {
      await ready;
      const result = await client.execute({ sql, args });
      return result.rows;
    },
    async one(sql, args = []) {
      const [first] = await this.rows(sql, args);
      return first ?? null;
    },
    async run(sql, args = []) {
      await ready;
      const result = await client.execute({ sql, args });
      return result.rowsAffected;
    },
    async reset() {
      await ready;
      await client.execute("PRAGMA foreign_keys = OFF");
      for (const table of APP_TABLES) await client.execute(`delete from ${table}`);
      await client.execute("PRAGMA foreign_keys = ON");
    },
    async close() {
      try {
        await client.close();
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
    /** Готовит строку аккаунта так, как её пишет приложение. */
    async insertAccount(account = {}) {
      const now = new Date().toISOString();
      const id = account.id ?? `account-${Math.random().toString(36).slice(2, 10)}`;
      await this.exec(
        `insert into accounts (id, email, password_hash, first_name, last_name, role, is_blocked, avatar, mfa_secret, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          account.email ?? `${id}@example.test`,
          account.passwordHash ?? null,
          account.firstName ?? null,
          account.lastName ?? null,
          account.role ?? "USER",
          account.isBlocked ? 1 : 0,
          account.avatar ?? null,
          account.mfaSecret ?? null,
          now,
          now,
        ],
      );
      return id;
    },
  };
}

module.exports = { createTestDatabase, schemaStatements, APP_TABLES };
