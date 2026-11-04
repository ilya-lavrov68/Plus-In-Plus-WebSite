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

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { changeOrderStatus, ORDER_TRANSITIONS } = require("../lib/order-guards.ts");
const { transitionOrder } = require("../lib/commerce-data.ts");
const { ORDER_STATUSES } = require("../lib/order-status.ts");

let database;
const admin = { id: "admin-1", role: "ADMIN" };
const founder = { id: "founder-1", role: "FOUNDER" };

before(async () => {
  database = createTestDatabase("pip-order-guards-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.reset();
  await database.insertAccount({ id: "admin-1", email: "admin@example.test", role: "ADMIN", passwordHash: "hash" });
  await database.insertAccount({ id: "founder-1", email: "founder@example.test", role: "FOUNDER", passwordHash: "hash" });
  await database.insertAccount({ id: "user-1", email: "client@example.test", role: "USER", passwordHash: "hash" });
});

async function insertOrder({ id = "ord-1", status = "pending", isLocked = false, orderNumber = `ПИП-${id}` } = {}) {
  await database.exec(
    `insert into orders (id, order_number, number, user_id_id, status, estimated_amount, subtotal, discount, total, currency, is_locked, created_at, updated_at)
     values (?, ?, ?, 'user-1', ?, 0, 0, 0, 0, 'RUB', ?, ?, ?)`,
    [id, orderNumber, orderNumber, status, isLocked ? 1 : 0, new Date().toISOString(), new Date().toISOString()],
  );
  return id;
}

async function status(orderId) {
  return (await database.one("select status from orders where id = ?", [orderId])).status;
}

async function succeededPayment(orderId) {
  await database.exec(
    `insert into payments (id, order_id_id, provider, external_id, provider_key, status, amount, currency, created_at, updated_at)
     values (?, ?, 'robokassa', 'invoice-1', 'key-1', 'succeeded', 10000, 'RUB', ?, ?)`,
    [`pay-${orderId}`, orderId, new Date().toISOString(), new Date().toISOString()],
  );
}

test("admin statuses follow the documented lifecycle and never jump", async () => {
  assert.deepEqual([...ORDER_STATUSES].slice(0, 4), ["pending", "quote_requested", "negotiating", "priced"]);
  assert.ok(ORDER_TRANSITIONS.pending.includes("quote_requested"));
  assert.ok(!ORDER_TRANSITIONS.pending.includes("completed"));

  const orderId = await insertOrder({ status: "pending" });
  await changeOrderStatus({ orderId, status: "quote_requested", actor: admin });
  assert.equal(await status(orderId), "quote_requested");

  await assert.rejects(changeOrderStatus({ orderId, status: "completed", actor: admin }), /Недопустимый переход/);
  assert.equal(await status(orderId), "quote_requested");

  await changeOrderStatus({ orderId, status: "negotiating", actor: admin });
  await assert.rejects(changeOrderStatus({ orderId, status: "unknown-status", actor: admin }), /Неизвестный статус/);
});

test("only the Robokassa webhook may mark an order as paid", async () => {
  const orderId = await insertOrder({ status: "priced" });
  await assert.rejects(changeOrderStatus({ orderId, status: "paid", actor: founder }), /webhook Robokassa/);
  assert.equal(await status(orderId), "priced");
});

test("work on an order requires a successful payment", async () => {
  const unpaid = await insertOrder({ id: "ord-unpaid", status: "paid" });
  await assert.rejects(
    changeOrderStatus({ orderId: unpaid, status: "in_progress", actor: admin }),
    /успешный платёж/,
  );
  assert.equal(await status(unpaid), "paid");

  const paid = await insertOrder({ id: "ord-paid", status: "paid" });
  await succeededPayment(paid);
  await changeOrderStatus({ orderId: paid, status: "in_progress", actor: admin });
  assert.equal(await status(paid), "in_progress");
  await changeOrderStatus({ orderId: paid, status: "completed", actor: admin });
  assert.equal(await status(paid), "completed");
});

test("a locked order is founder-only and the cart is not an admin record", async () => {
  const locked = await insertOrder({ id: "ord-locked", status: "negotiating", isLocked: true });
  await assert.rejects(
    changeOrderStatus({ orderId: locked, status: "cancelled", actor: admin }),
    /только основатель/,
  );
  await changeOrderStatus({ orderId: locked, status: "cancelled", actor: founder });
  assert.equal(await status(locked), "cancelled");

  const cart = await insertOrder({ id: "ord-cart", status: "cart" });
  await assert.rejects(
    changeOrderStatus({ orderId: cart, status: "cancelled", actor: founder }),
    /Корзина/,
  );
  assert.equal(await status(cart), "cart");
});

test("a concurrent status change is never overwritten", async () => {
  const orderId = await insertOrder({ status: "pending" });
  // Кто-то успел сменить статус между чтением и записью.
  await database.exec("update orders set status = 'cancelled' where id = ?", [orderId]);
  assert.equal(await transitionOrder(orderId, "pending", { status: "negotiating" }), false);
  assert.equal(await status(orderId), "cancelled");
});

test("the deleted CMS hooks are not needed for these rules", () => {
  const root = path.resolve(__dirname, "..");
  assert.equal(fs.existsSync(path.join(root, "data", "hooks.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "app", "(payload)")), false);
  const source = fs.readFileSync(path.join(root, "lib", "order-guards.ts"), "utf8");
  assert.match(source, /ORDER_TRANSITIONS/);
  assert.match(source, /transitionOrder\(order\.id, order\.status/);
});
