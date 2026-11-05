const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );

let database;
let statements = [];

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/auth") return { auth: async () => ({ user: { id: "customer" } }) };
  if (name === "@/lib/db") {
    const real = originalLoad.call(this, path.resolve(__dirname, "..", "lib", "db.ts"), parent, isMain);
    const record = (sql) => statements.push(String(sql).replace(/\s+/g, " ").trim());
    return {
      ...real,
      rows: async (sql, args) => {
        record(sql);
        return real.rows(sql, args);
      },
      run: async (sql, args) => {
        record(sql);
        return real.run(sql, args);
      },
      row: async (sql, args) => {
        record(sql);
        return real.row(sql, args);
      },
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { getCustomerOrders } = require("../lib/customer-orders.ts");
const { getOrderStats } = require("../lib/admin-analytics.ts");

before(async () => {
  database = createTestDatabase("pip-scale-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  statements = [];
  await database.reset();
  const now = new Date().toISOString();
  await database.exec(
    `insert into accounts (id, email, password_hash, role, is_blocked, created_at, updated_at)
     values ('customer', 'customer@example.test', 'hash', 'USER', 0, ?, ?)`,
    [now, now],
  );
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price, price_type,
       currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
     values ('svc-1', 'Sign Design', 'sign-design', 'small', 'Short', 'Full', 'Result', 100000, 'from',
       'RUB', 1, 1, 1, 0, ?, ?)`,
    [now, now],
  );
  for (const [id, number, status] of [
    ["ord-1", "ПИП-000001", "pending"],
    ["ord-2", "ПИП-000002", "paid"],
  ]) {
    await database.exec(
      `insert into orders (id, order_number, number, user_id_id, status, estimated_amount, total, created_at, updated_at)
       values (?, ?, ?, 'customer', ?, 100, 0, ?, ?)`,
      [id, number, number, status, now, now],
    );
    await database.exec(
      `insert into order_items (id, order_id_id, item_type, item_id, service_id_id, title, quantity,
         estimated_unit_price, unit_price, total_price, options_snapshot, created_at, updated_at)
       values (?, ?, 'service', 'svc-1', 'svc-1', 'Sign', 1, 100, 0, 0, '[]', ?, ?)`,
      [`item-${id}`, id, now, now],
    );
    await database.exec(
      `insert into order_services (id, order_id_id, service_id_id, quantity, created_at, updated_at)
       values (?, ?, 'svc-1', 1, ?, ?)`,
      [`link-${id}`, id, now, now],
    );
  }
  await database.exec(
    `insert into payments (id, order_id_id, provider, external_id, provider_key, status, amount, currency, created_at, updated_at)
     values ('pay-1', 'ord-2', 'robokassa', 'inv-1', 'key-1', 'succeeded', 20000, 'RUB', ?, ?)`,
    [now, now],
  );
});

test("customer orders use a bounded number of reads that does not grow with order count", async () => {
  const orders = await getCustomerOrders();
  assert.equal(orders.length, 2);
  assert.equal(orders.flatMap((order) => order.items).length, 2, "no per-order item query");
  assert.equal(orders.flatMap((order) => order.services).length, 2);

  const reads = statements.filter((sql) => /^select/i.test(sql));
  // Заказы, позиции, связи, счета и справочник услуг (3 запроса) — не по запросу на заказ.
  assert.ok(reads.length <= 8, `unexpected read amplification: ${reads.length}\n${reads.join("\n")}`);
  assert.equal(new Set(reads).size, reads.length, "nothing is queried twice");
  const batched = reads.filter((sql) => /where order_id_id in \(\?, \?\)/.test(sql));
  assert.equal(batched.length, 3, "items, links and payments are fetched for both orders at once");
});

test("order revenue and queue metrics come from one aggregate query", async () => {
  const stats = await getOrderStats();
  // payments.amount хранится в копейках, админка считает в рублях: 20000 → 200 ₽.
  assert.deepEqual(stats, { queue: 1, revenue: 200, paidCount: 1, averageOrder: 200 });

  const aggregates = statements.filter((sql) => /coalesce\(sum\(amount\), 0\)/i.test(sql));
  assert.equal(aggregates.length, 1, "revenue is aggregated in SQL, not scanned row by row");
  assert.match(aggregates[0], /exists/i, "paid orders are detected with EXISTS, not a second scan");
});
