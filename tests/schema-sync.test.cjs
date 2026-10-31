const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createClient } = require("@libsql/client");

const { applyOfflineSqliteDdl } = require("../scripts/lib/db-cli.cjs");
const { checkSchema } = require("../scripts/lib/schema-check.cjs");

function temporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pip-schema-sync-"));
  return {
    url: `file:${path.join(directory, "test.db")}`,
    cleanup() {
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function getIndex(client, table, name) {
  const result = await client.execute(`pragma index_list("${table}")`);
  return result.rows.find((row) => String(row.name) === name);
}

test("additive local sync creates the complete schema and current unique indexes", async () => {
  const database = temporaryDatabase();
  try {
    await applyOfflineSqliteDdl({ TURSO_DATABASE_URL: database.url });
    const status = await checkSchema({ url: database.url, schemaPath: undefined });
    assert.equal(status.ok, true, JSON.stringify(status));

    const client = createClient({ url: database.url });
    try {
      const orderColumns = await client.execute('pragma table_info("orders")');
      assert.ok(orderColumns.rows.some((row) => String(row.name) === "cartKey"));

      for (const [table, name, columns] of [
        ["orders", "orders_cartKey_key", ["cartKey"]],
        ["payments", "payments_provider_externalId_key", ["provider", "externalId"]],
      ]) {
        const index = await getIndex(client, table, name);
        assert.ok(index, `Missing ${name}`);
        assert.equal(Number(index.unique), 1, `${name} must be unique`);
        const info = await client.execute(`pragma index_info("${name}")`);
        assert.deepEqual(
          info.rows.sort((a, b) => Number(a.seqno) - Number(b.seqno)).map((row) => String(row.name)),
          columns,
        );
      }

      const paymentIndexes = await client.execute('pragma index_list("payments")');
      assert.ok(
        !paymentIndexes.rows.some((row) => String(row.name) === "payments_provider_externalId_idx"),
        "The redundant non-unique payment index must be replaced",
      );
    } finally {
      client.close();
    }

    const devSource = fs.readFileSync(path.join(__dirname, "../scripts/dev.cjs"), "utf8");
    const additivePosition = devSource.indexOf("await applyOfflineSqliteDdl(env)");
    const prismaPosition = devSource.indexOf("await pushSchema({ env })");
    assert.ok(additivePosition >= 0, "dev must use the additive local updater");
    assert.ok(prismaPosition > additivePosition, "Prisma CLI must remain the fallback");
  } finally {
    database.cleanup();
  }
});

test("additive local sync adds cartKey without rebuilding or deleting an existing order", async () => {
  const database = temporaryDatabase();
  try {
    const legacy = createClient({ url: database.url });
    try {
      await legacy.execute(`CREATE TABLE "orders" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderNumber" TEXT,
        "number" TEXT,
        "userId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'cart',
        "managerId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await legacy.execute({
        sql: 'INSERT INTO "orders" ("id", "userId", "status") VALUES (?, ?, ?)',
        args: ["existing-order", "existing-user", "pending"],
      });
    } finally {
      legacy.close();
    }

    await applyOfflineSqliteDdl({ TURSO_DATABASE_URL: database.url });

    const client = createClient({ url: database.url });
    try {
      const rows = await client.execute(
        'SELECT "id", "userId", "status", "cartKey" FROM "orders"',
      );
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0].id, "existing-order");
      assert.equal(rows.rows[0].userId, "existing-user");
      assert.equal(rows.rows[0].status, "pending");
      assert.equal(rows.rows[0].cartKey, null);
      assert.equal(Number((await getIndex(client, "orders", "orders_cartKey_key")).unique), 1);
    } finally {
      client.close();
    }
  } finally {
    database.cleanup();
  }
});

test("duplicate payment identifiers stop unique-index creation without deleting rows", async () => {
  const database = temporaryDatabase();
  try {
    const legacy = createClient({ url: database.url });
    try {
      await legacy.execute(`CREATE TABLE "payments" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderId" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "externalId" TEXT
      )`);
      await legacy.execute({
        sql: 'INSERT INTO "payments" ("id", "orderId", "provider", "externalId") VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
        args: [
          "payment-1", "order-1", "robokassa", "42",
          "payment-2", "order-1", "robokassa", "42",
        ],
      });
    } finally {
      legacy.close();
    }

    await assert.rejects(
      applyOfflineSqliteDdl({ TURSO_DATABASE_URL: database.url }),
    );

    const client = createClient({ url: database.url });
    try {
      const rows = await client.execute(
        'SELECT "id" FROM "payments" ORDER BY "id"',
      );
      assert.deepEqual(rows.rows.map((row) => row.id), ["payment-1", "payment-2"]);
    } finally {
      client.close();
    }
  } finally {
    database.cleanup();
  }
});
