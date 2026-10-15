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
let admin, customer, orders, orderItems, payments, logs, invalidated, sequence;

const prisma = {
  order: {
    findUnique: async ({ where }) => structuredClone(orders.get(where.id) ?? null),
    count: async () => orders.size,
    update: async ({ where, data }) => {
      const row = orders.get(where.id);
      if (!row) throw new Error("missing order");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  orderItem: {
    update: async ({ where, data }) => {
      const row = orderItems.get(where.id);
      if (!row) throw new Error("missing item");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  payment: {
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
prisma.$transaction = async (callback) => callback(prisma);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/admin-session") return { requireAdmin: async () => admin };
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name === "@/auth") return { auth: async () => (customer ? { user: { id: customer.id } } : null) };
  if (name === "next/cache") return { revalidatePath: (url) => invalidated.push(url) };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { setOrderPrice, updateOrderStatus } = require("../app/actions/orders.ts");

/** Заявка с расчётом 30 000 ₽ и одной позицией. */
function seedOrder(overrides = {}) {
  const id = "ord-test";
  orders.set(id, {
    id,
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
});

test("setOrderPrice: фиксирует цену, статус и менеджера", async () => {
  const id = seedOrder();
  const result = await setOrderPrice({ orderId: id, amountRub: "35000", managerNote: "Срочность" });

  assert.equal(result.ok, true);
  const order = orders.get(id);
  assert.equal(order.total, 3_500_000, "рубли переведены в копейки");
  assert.equal(order.status, "awaiting_payment");
  assert.equal(order.managerId, "usr-admin");
  assert.equal(order.managerNote, "Срочность");
  assert.ok(order.priceAgreedAt instanceof Date, "время фиксации записано");
});

test("setOrderPrice: создаёт счёт на согласованную сумму", async () => {
  const id = seedOrder();
  await setOrderPrice({ orderId: id, amountRub: "35000" });

  assert.equal(payments.size, 1);
  const payment = [...payments.values()][0];
  assert.equal(payment.amount, 3_500_000);
  assert.equal(payment.status, "pending");
  assert.equal(payment.orderId, id);
  // Ссылки пока нет — её даст платёжный провайдер.
  assert.equal(payment.paymentUrl, null);
});

test("setOrderPrice: раскладывает сумму по позициям пропорционально", async () => {
  const id = seedOrder();
  // Вторая позиция с таким же расчётом — каждая должна получить половину.
  orderItems.set("item-2", {
    id: "item-2", orderId: id, title: "Монтаж", quantity: 1,
    estimatedUnitPrice: 3_000_000, unitPrice: 0, totalPrice: 0,
  });
  orders.get(id).items = [orderItems.get("item-1"), orderItems.get("item-2")];

  // Менеджер поднял цену с 60 000 до 75 000 ₽ (суммарный расчёт двух позиций).
  await setOrderPrice({ orderId: id, amountRub: "75000" });

  const first = orderItems.get("item-1");
  const second = orderItems.get("item-2");
  assert.equal(first.totalPrice, 3_750_000);
  assert.equal(second.totalPrice, 3_750_000);
  assert.equal(first.totalPrice + second.totalPrice, 7_500_000, "сумма позиций сходится с итогом");
});

test("setOrderPrice: пишет действие в журнал", async () => {
  const id = seedOrder();
  await setOrderPrice({ orderId: id, amountRub: "35000" });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "priced");
  assert.equal(logs[0].entityType, "order");
  assert.equal(logs[0].actorId, "usr-admin");
});

test("setOrderPrice: отвергает некорректные суммы", async () => {
  const id = seedOrder();
  for (const amountRub of ["", "abc", "-100", "999999999"]) {
    const result = await setOrderPrice({ orderId: id, amountRub });
    assert.equal(result.ok, false, `«${amountRub}» не должно проходить`);
  }
  // Ничего не изменилось.
  assert.equal(orders.get(id).total, 0);
  assert.equal(payments.size, 0);
});

test("setOrderPrice: принимает запятую как разделитель", async () => {
  const id = seedOrder();
  const result = await setOrderPrice({ orderId: id, amountRub: "1234,50" });
  assert.equal(result.ok, true);
  assert.equal(orders.get(id).total, 123_450);
});

test("setOrderPrice: не трогает закрытые заказы", async () => {
  for (const status of ["cancelled", "refunded"]) {
    orders = new Map(); orderItems = new Map(); payments = new Map(); logs = [];
    const id = seedOrder({ status });
    const result = await setOrderPrice({ orderId: id, amountRub: "35000" });
    assert.equal(result.ok, false, `${status} нельзя переоценить`);
    assert.equal(orders.get(id).total, 0);
  }
});

test("setOrderPrice: недоступен без прав администратора", async () => {
  admin = null;
  const id = seedOrder();
  const result = await setOrderPrice({ orderId: id, amountRub: "35000" });
  assert.equal(result.ok, false);
  assert.equal(orders.get(id).total, 0);
});

test("updateOrderStatus: переводит заказ в следующий статус", async () => {
  const id = seedOrder({ status: "paid" });
  const result = await updateOrderStatus({ orderId: id, status: "in_progress" });
  assert.equal(result.ok, true);
  assert.equal(orders.get(id).status, "in_progress");
});

test("updateOrderStatus: оплаченным может отметить только платёжная система", async () => {
  const id = seedOrder({ status: "awaiting_payment" });
  const result = await updateOrderStatus({ orderId: id, status: "paid" });
  assert.equal(result.ok, false);
  assert.equal(orders.get(id).status, "awaiting_payment", "статус не изменился");
});

test("updateOrderStatus: отвергает неизвестный статус", async () => {
  const id = seedOrder();
  const result = await updateOrderStatus({ orderId: id, status: "whatever" });
  assert.equal(result.ok, false);
});
