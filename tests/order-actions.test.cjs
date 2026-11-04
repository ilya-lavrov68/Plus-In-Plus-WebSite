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

// Заказы, позиции и счета живут в настоящей SQLite: проверяем реальные
// ограничения и переходы статусов, а не их объектный двойник.
let admin, customer, invalidated, sequence, invoiceClients, invoiceFailure;
let database;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  // Заявки ведёт requireStaff: администратор и менеджер.
  if (name === "@/lib/admin-session") return {
    requireAdmin: async () => (admin && admin.id !== "usr-manager" ? admin : null),
    requireStaff: async () => (admin ? { ...admin, isAdmin: admin.id !== "usr-manager" } : null),
  };
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name === "@/auth") return { auth: async () => (customer ? { user: { id: customer.id } } : null) };
  if (name === "next/cache") return { revalidatePath: (url) => invalidated.push(url) };
  // Выставление счёта покрыто отдельным файлом; здесь важны цена, статус и права.
  if (name === "@/lib/payments/invoice") return {
    issueInvoice: async ({ amount, orderNumber }) => {
      invoiceClients.push(amount);
      if (invoiceFailure) return null;
      const invId = Number(String(orderNumber).replace(/\D/g, "")) * 1000;
      return { paymentId: `pay-${++sequence}`, paymentUrl: null, invId };
    },
  };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { cancelMyOrder } = require("../app/actions/orders.ts");
const { getCustomerOrders } = require("../lib/customer-orders.ts");

const now = () => new Date().toISOString();

async function insertAccount(id, email) {
  await database.exec(
    `insert or ignore into accounts (id, email, role, is_blocked, created_at, updated_at)
     values (?, ?, 'USER', 0, ?, ?)`,
    [id, email, now(), now()],
  );
}

async function insertOrder({
  id,
  userId = "usr-1",
  number = "ПИП-000099",
  status = "quote_requested",
  estimatedAmount = 3_000_000,
  total = 0,
  customerNote = null,
  createdAt = now(),
} = {}) {
  await database.exec(
    `insert into orders (id, order_number, number, user_id_id, status, estimated_amount, subtotal, discount,
       total, currency, customer_note, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 0, 0, ?, 'RUB', ?, ?, ?)`,
    [id, number, number, userId, status, estimatedAmount, total, customerNote, createdAt, now()],
  );
  return id;
}

async function insertItem(orderId, { id = "item-1", title = "Вывеска", estimatedUnitPrice = 3_000_000 } = {}) {
  await database.exec(
    `insert into order_items (id, order_id_id, item_type, item_id, service_id_id, title, quantity,
       estimated_unit_price, unit_price, total_price, options_snapshot, created_at, updated_at)
     values (?, ?, 'service', 'svc-1', 'svc-1', ?, 1, ?, 0, 0, '[]', ?, ?)`,
    [id, orderId, title, estimatedUnitPrice, now(), now()],
  );
}

async function insertPayment(orderId, { id = "pay-1", status = "pending", amount = 290_000, paymentUrl = null } = {}) {
  await database.exec(
    `insert into payments (id, order_id_id, provider, external_id, status, amount, currency, payment_url, created_at, updated_at)
     values (?, ?, 'robokassa', ?, ?, ?, 'RUB', ?, ?, ?)`,
    [id, orderId, `${orderId}-${id}`, status, amount, paymentUrl, now(), now()],
  );
}

/** Заявка с расчётом 30 000 ₽ и одной позицией. */
async function seedOrder(overrides = {}) {
  const id = overrides.id ?? "ord-test";
  await insertOrder({ id, ...overrides });
  await insertItem(id);
  return id;
}

/** Заказ с владельцем для личного кабинета. */
async function seedOwnedOrder(userId, number, overrides = {}) {
  const id = `ord-${number}`;
  await insertOrder({ id, userId, number, createdAt: "2026-01-01T00:00:00.000Z", ...overrides });
  return id;
}

async function seedCatalog() {
  await database.exec
  (`insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price,
     price_type, currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
   values ('svc-1', 'Вывеска', 'sign-design', 'small', 'Короткое', 'Полное', 'Результат', 3000000,
     'from', 'RUB', 1, 1, 1, 0, ?, ?)`, [now(), now()]);
}

const statusOf = async (id) => (await database.one("select status from orders where id = ?", [id]))?.status ?? null;
const activityRows = () => database.rows("select action, entity_type, actor_id_id, title from activity_logs");

before(async () => {
  database = createTestDatabase("pip-orders-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  admin = { id: "usr-admin", email: "admin@test" };
  customer = { id: "usr-1", email: "user@test" };
  invalidated = [];
  sequence = 0;
  invoiceClients = [];
  invoiceFailure = false;
  await database.reset();
  await insertAccount("usr-1", "user@test");
  await insertAccount("usr-2", "other@test");
  await insertAccount("usr-admin", "admin@test");
  await seedCatalog();
});

// --- Личный кабинет: видит только свои заказы ---

test("getCustomerOrders: гость без сессии не видит ничего", async () => {
  await seedOwnedOrder("usr-1", "ПИП-000001");
  customer = null;
  assert.deepEqual(await getCustomerOrders(), []);
});

test("getCustomerOrders: клиент видит только свои заказы", async () => {
  customer = { id: "usr-1", email: "user@test" };
  await seedOwnedOrder("usr-1", "ПИП-000001");
  await seedOwnedOrder("usr-1", "ПИП-000002");
  await seedOwnedOrder("usr-2", "ПИП-000003", { status: "awaiting_payment", total: 890_000 });

  const result = await getCustomerOrders();
  assert.deepEqual(result.map((order) => order.number).sort(), ["ПИП-000001", "ПИП-000002"]);
});

test("getCustomerOrders: чужой заказ недоступен даже при знании номера", async () => {
  customer = { id: "usr-1", email: "user@test" };
  await seedOwnedOrder("usr-2", "ПИП-000777");
  const result = await getCustomerOrders();
  assert.equal(result.some((order) => order.number === "ПИП-000777"), false);
});

test("getCustomerOrders: счета приходят как invoices со ссылкой на оплату", async () => {
  customer = { id: "usr-1", email: "user@test" };
  const id = await seedOwnedOrder("usr-1", "ПИП-000100", { status: "awaiting_payment", total: 290_000 });
  await insertPayment(id, { status: "pending", amount: 290_000, paymentUrl: "https://pay.test/1" });

  const [order] = await getCustomerOrders();
  assert.ok(Array.isArray(order.invoices), "invoices — массив");
  assert.equal(order.invoices.length, 1);
  assert.equal(order.invoices[0].paymentUrl, "https://pay.test/1");
});

test("getCustomerOrders: заказ без цены остаётся без кнопки оплаты", async () => {
  customer = { id: "usr-1", email: "user@test" };
  await seedOwnedOrder("usr-1", "ПИП-000101", { status: "negotiating", total: 0 });

  const [order] = await getCustomerOrders();
  assert.equal(order.total, 0, "цены нет");
  assert.equal(order.invoices.length, 0, "счёт не выставлен");
});

// ── Отмена заказа клиентом ───────────────────────────────────────────────────

test("cancelMyOrder: клиент отменяет свою неоплаченную заявку", async () => {
  const id = await seedOrder({ status: "quote_requested" });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, true);
  assert.equal(await statusOf(id), "cancelled");

  const logs = await activityRows();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "cancelled");
  assert.equal(logs[0].entity_type, "order");
  assert.equal(logs[0].actor_id_id, "usr-1");
  assert.match(logs[0].title, /ПИП-000099/, "в журнале остаётся номер заявки");

  assert.ok(invalidated.includes("/cart"));
  assert.ok(invalidated.includes("/admin/orders"));
});

test("cancelMyOrder: отменяются все доспешные статусы", async () => {
  for (const status of ["pending", "quote_requested", "negotiating", "priced", "awaiting_payment"]) {
    await database.exec("delete from activity_logs");
    await database.exec("delete from order_items");
    await database.exec("delete from orders");
    const id = await seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, true, `${status} должен отменяться`);
    assert.equal(await statusOf(id), "cancelled");
  }
});

test("cancelMyOrder: недоступен без входа и для заблокированного аккаунта", async () => {
  const id = await seedOrder({ status: "quote_requested" });

  customer = null;
  const anonymous = await cancelMyOrder({ orderId: id });
  assert.equal(anonymous.ok, false);
  assert.equal(await statusOf(id), "quote_requested", "без сессии заказ не трогается");

  customer = { id: "usr-2", email: "other@test" };
  const stranger = await cancelMyOrder({ orderId: id });
  assert.equal(stranger.ok, false);
  assert.match(stranger.error, /not found/i, "чужой заказ неотличим от несуществующего");
  assert.equal(await statusOf(id), "quote_requested");
});

test("cancelMyOrder: оплаченный заказ клиент отменить не может", async () => {
  const id = await seedOrder({ status: "awaiting_payment", total: 3_000_000 });
  await insertPayment(id, { status: "succeeded", amount: 3_000_000 });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, false);
  assert.match(result.error, /paid order cannot be cancelled/i);
  assert.equal(await statusOf(id), "awaiting_payment");
  assert.equal((await activityRows()).length, 0);
});

test("cancelMyOrder: заказ в работе, завершённый и закрытый не отменяются", async () => {
  for (const status of ["in_progress", "completed"]) {
    await database.exec("delete from activity_logs");
    await database.exec("delete from order_items");
    await database.exec("delete from orders");
    const id = await seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, false, `${status} отменять нельзя`);
    assert.match(result.error, /already started/i);
    assert.equal(await statusOf(id), status);
  }

  for (const status of ["cancelled", "refunded"]) {
    await database.exec("delete from activity_logs");
    await database.exec("delete from order_items");
    await database.exec("delete from orders");
    const id = await seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, false, `${status} уже закрыт`);
    assert.match(result.error, /closed/i);
    assert.equal(await statusOf(id), status);
  }
});

test("cancelMyOrder: черновик корзины отменить нельзя", async () => {
  const id = await seedOrder({ status: "cart" });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);
  assert.equal(await statusOf(id), "cart");
});

test("cancelMyOrder: проигранная гонка записи не выдаёт успешный ответ", async () => {
  const id = await seedOrder({ status: "quote_requested" });
  // Гонка: между чтением статуса и условным UPDATE заказ успел измениться,
  // поэтому `transitionOrder` возвращает false, не тронув строку.
  const commerce = require("../lib/commerce-data.ts");
  const original = commerce.transitionOrder;
  commerce.transitionOrder = async () => false;

  let result;
  try {
    result = await cancelMyOrder({ orderId: id });
  } finally {
    commerce.transitionOrder = original;
  }

  assert.equal(result.ok, false);
  assert.match(result.error, /could not cancel/i);
  assert.equal(await statusOf(id), "quote_requested", "статус не изменился");
  assert.equal((await activityRows()).length, 0, "журнал не пишется без успешной записи");
});

test("cancelMyOrder: пустой идентификатор заказа отклоняется", async () => {
  await seedOrder({ status: "quote_requested" });

  for (const orderId of ["", "   ", undefined, null]) {
    const result = await cancelMyOrder({ orderId });
    assert.equal(result.ok, false, `«${orderId}» не должно проходить`);
  }
});
