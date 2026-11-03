const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );

// Только в памяти. Никаких записей в реальную БД.
let admin, customer, orders, orderItems, payments, logs, invalidated, sequence, invoiceClients, invoiceFailure, writeRaceLost;

const db = {
  user: {
    // requireCustomer проверяет, что аккаунт жив и не заблокирован.
    findUnique: async ({ where }) =>
      customer && where.id === customer.id
        ? { id: customer.id, email: customer.email, isBlocked: false }
        : null,
  },
  order: {
    findUnique: async ({ where }) => structuredClone(orders.get(where.id) ?? null),
    // Личный кабинет: фильтр по владельцу обязателен, иначе подстановка
    // чужого userId в запрос отдала бы чужие заказы.
    findMany: async ({ where = {} } = {}) => {
      const rows = [...orders.values()].filter(
        (row) => (!where.userId || row.userId === where.userId) && (!where.status?.not || row.status !== where.status.not),
      );
      return structuredClone(rows.map((row) => ({ ...row, payments: row.payments ?? [] })));
    },
    count: async () => orders.size,
    update: async ({ where, data }) => {
      const row = orders.get(where.id);
      if (!row) throw new Error("missing order");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      const row = orders.get(where.id);
      // Имитация гонки: между чтением и записью заказ успел измениться.
      if (writeRaceLost) return { count: 0 };
      if (!row || (where.status && row.status !== where.status) || (where.userId && row.userId !== where.userId)) return { count: 0 };
      const successful = (row.payments ?? []).some((payment) => payment.status === "succeeded");
      if (where.payments?.none && successful) return { count: 0 };
      if (where.payments?.some && !successful) return { count: 0 };
      Object.assign(row, structuredClone(data));
      return { count: 1 };
    },
  },
  orderItem: {
    findMany: async ({ where = {} } = {}) => [...orderItems.values()]
      .filter((row) => !where.orderId || (typeof where.orderId === "string" ? row.orderId === where.orderId : where.orderId.in?.includes(row.orderId)))
      .map((row) => structuredClone(row)),
    update: async ({ where, data }) => {
      const row = orderItems.get(where.id);
      if (!row) throw new Error("missing item");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  orderService: { findMany: async () => [] },
  payment: {
    findMany: async ({ where = {} } = {}) => {
      const rows = new Map(payments);
      for (const order of orders.values()) for (const payment of order.payments ?? []) {
        rows.set(payment.id, { orderId: order.id, ...payment });
      }
      return [...rows.values()]
        .filter((row) => !where.orderId || (typeof where.orderId === "string" ? row.orderId === where.orderId : where.orderId.in?.includes(row.orderId)))
        .map((row) => structuredClone(row));
    },
    count: async ({ where = {} } = {}) => {
      const rows = await db.payment.findMany({ where });
      return rows.filter((row) => !where.status || row.status === where.status).length;
    },
    create: async ({ data }) => {
      const row = { id: `pay-${++sequence}`, ...structuredClone(data) };
      payments.set(row.id, row);
      return structuredClone(row);
    },
  },
  activityLog: {
    create: async ({ data }) => { logs.push(structuredClone(data)); return data; },
  },
};
db.transaction = async (callback) => {
  const snapshot = structuredClone({ orders, orderItems, payments, logs });
  try {
    return await callback(db);
  } catch (error) {
    orders = snapshot.orders;
    orderItems = snapshot.orderItems;
    payments = snapshot.payments;
    logs = snapshot.logs;
    throw error;
  }
};

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
  // Выставление счёта в этих тестах не проверяем — здесь важна цена, статус
  // и права. Провайдер оплаты покрыт отдельным файлом.
  if (name === "@/lib/payments/invoice") return { issueInvoice: async ({ amount, orderNumber }, tx) => {
    invoiceClients.push(tx);
    if (invoiceFailure) return null;
    const row = { id: `pay-${++sequence}`, orderId: "ord-test", provider: "robokassa",
      externalId: String(Number(orderNumber.replace(/\D/g, "")) * 1000),
      status: "pending", amount, currency: "RUB", paymentUrl: null, createdAt: new Date() };
    payments.set(row.id, row);
    return { paymentId: row.id, paymentUrl: null, invId: Number(row.externalId) };
  } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { cancelMyOrder } = require("../app/actions/orders.ts");
const { getCustomerOrders } = require("../lib/customer-orders.ts");

/** Заявка с расчётом 30 000 ₽ и одной позицией. */
function seedOrder(overrides = {}) {
  const id = "ord-test";
  orders.set(id, {
    id,
    userId: "usr-1",
    number: "ПИП-000099",
    status: "quote_requested",
    estimatedAmount: 3_000_000,
    subtotal: 0,
    discount: 0,
    total: 0,
    currency: "RUB",
    customerNote: "Хочу побыстрее",
    managerNote: null,
    priceAgreedAt: null,
    payments: [],
    ...overrides,
  });
  orderItems.set("item-1", {
    id: "item-1",
    orderId: id,
    title: "Вывеска",
    quantity: 1,
    estimatedUnitPrice: 3_000_000,
    unitPrice: 0,
    totalPrice: 0,
  });
  // findUnique заказа должен видеть позиции.
  orders.get(id).items = [orderItems.get("item-1")];
  return id;
}

beforeEach(() => {
  admin = { id: "usr-admin", email: "admin@test" };
  customer = { id: "usr-1", email: "user@test" };
  orders = new Map();
  orderItems = new Map();
  payments = new Map();
  logs = [];
  invalidated = [];
  sequence = 0;
  invoiceClients = [];
  invoiceFailure = false;
  writeRaceLost = false;
});

// --- Личный кабинет: видит только свои заказы ---

/** Заказ с владельцем; findMany для клиента фильтрует по нему. */
function seedOwnedOrder(userId, number, overrides = {}) {
  const id = `ord-${number}`;
  orders.set(id, {
    id,
    userId,
    number,
    status: "quote_requested",
    estimatedAmount: 3_000_000,
    total: 0,
    currency: "RUB",
    customerNote: null,
    managerNote: null,
    createdAt: new Date("2026-01-01"),
    paidAt: null,
    payments: [],
    ...overrides,
  });
  return id;
}

test("getCustomerOrders: гость без сессии не видит ничего", async () => {
  seedOwnedOrder("usr-1", "ПИП-000001");
  customer = null;
  assert.deepEqual(await getCustomerOrders(), []);
});

test("getCustomerOrders: клиент видит только свои заказы", async () => {
  customer = { id: "usr-1", email: "user@test" };
  seedOwnedOrder("usr-1", "ПИП-000001");
  seedOwnedOrder("usr-1", "ПИП-000002");
  seedOwnedOrder("usr-2", "ПИП-000003", { status: "awaiting_payment", total: 890_000 });

  const result = await getCustomerOrders();
  const numbers = result.map((order) => order.number).sort();
  assert.deepEqual(numbers, ["ПИП-000001", "ПИП-000002"]);
});

test("getCustomerOrders: чужой заказ недоступен даже при знании номера", async () => {
  customer = { id: "usr-1", email: "user@test" };
  seedOwnedOrder("usr-2", "ПИП-000777");
  const result = await getCustomerOrders();
  assert.equal(result.some((order) => order.number === "ПИП-000777"), false);
});

test("getCustomerOrders: счета приходят как invoices со ссылкой на оплату", async () => {
  customer = { id: "usr-1", email: "user@test" };
  seedOwnedOrder("usr-1", "ПИП-000100", {
    status: "awaiting_payment",
    total: 290_000,
    payments: [{ id: "pay-1", status: "pending", amount: 290_000, paymentUrl: "https://pay.test/1", createdAt: new Date(), paidAt: null }],
  });

  const [order] = await getCustomerOrders();
  assert.ok(Array.isArray(order.invoices), "invoices — массив");
  assert.equal(order.invoices.length, 1);
  assert.equal(order.invoices[0].paymentUrl, "https://pay.test/1");
});

test("getCustomerOrders: заказ без цены остаётся без кнопки оплаты", async () => {
  customer = { id: "usr-1", email: "user@test" };
  seedOwnedOrder("usr-1", "ПИП-000101", { status: "negotiating", total: 0 });

  const [order] = await getCustomerOrders();
  assert.equal(order.total, 0, "цены нет");
  assert.equal(order.invoices.length, 0, "счёт не выставлен");
});

// ── Отмена заказа клиентом ───────────────────────────────────────────────────

test("cancelMyOrder: клиент отменяет свою неоплаченную заявку", async () => {
  const id = seedOrder({ status: "quote_requested" });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, true);
  assert.equal(orders.get(id).status, "cancelled");
  // Отмена видна в журнале действий вместе с автором.
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "cancelled");
  assert.equal(logs[0].entityType, "order");
  assert.equal(logs[0].actorId, "usr-1");
  assert.match(logs[0].title, /ПИП-000099/);
  // Объединённая страница корзины и заказы в админке должны обновиться.
  assert.ok(invalidated.includes("/cart"));
  assert.ok(invalidated.includes("/admin/orders"));
});

test("cancelMyOrder: отменяются все доспешные статусы", async () => {
  for (const status of ["pending", "quote_requested", "negotiating", "priced", "awaiting_payment"]) {
    orders = new Map(); orderItems = new Map(); payments = new Map(); logs = [];
    const id = seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, true, `${status} должен отменяться`);
    assert.equal(orders.get(id).status, "cancelled");
  }
});

test("cancelMyOrder: недоступен без входа и для заблокированного аккаунта", async () => {
  const id = seedOrder({ status: "quote_requested" });

  customer = null;
  const anonymous = await cancelMyOrder({ orderId: id });
  assert.equal(anonymous.ok, false);
  assert.equal(orders.get(id).status, "quote_requested", "без сессии заказ не трогается");

  customer = { id: "usr-other", email: "other@test" };
  const stranger = await cancelMyOrder({ orderId: id });
  assert.equal(stranger.ok, false);
  assert.match(stranger.error, /not found/i, "чужой заказ неотличим от несуществующего");
  assert.equal(orders.get(id).status, "quote_requested");
});

test("cancelMyOrder: оплаченный заказ клиент отменить не может", async () => {
  const id = seedOrder({
    status: "awaiting_payment",
    total: 3_000_000,
    payments: [{ id: "pay-1", status: "succeeded", amount: 3_000_000 }],
  });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, false);
  assert.match(result.error, /paid order cannot be cancelled/i);
  assert.equal(orders.get(id).status, "awaiting_payment");
  assert.equal(logs.length, 0);
});

test("cancelMyOrder: заказ в работе, завершённый и закрытый не отменяются", async () => {
  for (const status of ["in_progress", "completed"]) {
    orders = new Map(); orderItems = new Map(); logs = [];
    const id = seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, false, `${status} отменять нельзя`);
    assert.match(result.error, /already started/i);
    assert.equal(orders.get(id).status, status);
  }

  for (const status of ["cancelled", "refunded"]) {
    orders = new Map(); orderItems = new Map(); logs = [];
    const id = seedOrder({ status });
    const result = await cancelMyOrder({ orderId: id });
    assert.equal(result.ok, false, `${status} уже закрыт`);
    assert.match(result.error, /closed/i);
    assert.equal(orders.get(id).status, status);
  }
});

test("cancelMyOrder: черновик корзины отменить нельзя", async () => {
  const id = seedOrder({ status: "cart" });

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);
  assert.equal(orders.get(id).status, "cart");
});

test("cancelMyOrder: проигранная гонка записи не выдаёт успешный ответ", async () => {
  const id = seedOrder({ status: "quote_requested" });
  writeRaceLost = true;

  const result = await cancelMyOrder({ orderId: id });

  assert.equal(result.ok, false);
  assert.match(result.error, /could not cancel/i);
  assert.equal(orders.get(id).status, "quote_requested", "статус не изменился");
  assert.equal(logs.length, 0, "журнал не пишется без успешной записи");
});

test("cancelMyOrder: пустой идентификатор заказа отклоняется", async () => {
  seedOrder({ status: "quote_requested" });

  for (const orderId of ["", "   ", undefined, null]) {
    const result = await cancelMyOrder({ orderId });
    assert.equal(result.ok, false, `«${orderId}» не должно проходить`);
  }
});
