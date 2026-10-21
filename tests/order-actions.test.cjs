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
    // Личный кабинет: фильтр по владельцу обязателен, иначе подстановка
    // чужого userId в запрос отдала бы чужие заказы.
    findMany: async ({ where = {} } = {}) => {
      const rows = [...orders.values()].filter(
        (row) => !where.userId || row.userId === where.userId,
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
  if (name === "@/lib/payments/invoice") return { issueInvoice: async ({ amount, orderNumber }) => {
    const row = { id: `pay-${++sequence}`, orderId: "ord-test", provider: "robokassa",
      externalId: String(Number(orderNumber.replace(/\D/g, "")) * 1000),
      status: "pending", amount, currency: "RUB", paymentUrl: null, createdAt: new Date() };
    payments.set(row.id, row);
    return { paymentId: row.id, paymentUrl: null, invId: Number(row.externalId) };
  } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { setOrderLocked, setOrderPrice, updateOrderStatus } = require("../app/actions/orders.ts");
const { getCustomerOrders } = require("../lib/customer-orders.ts");

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

test("setOrderPrice: менеджер может согласовать цену", async () => {
  // Менеджер работает с заявками — это его основная задача.
  admin = { id: "usr-manager", email: "manager@test" };
  const id = seedOrder();
  const result = await setOrderPrice({ orderId: id, amountRub: "35000" });

  assert.equal(result.ok, true);
  assert.equal(orders.get(id).total, 3_500_000);
  assert.equal(orders.get(id).managerId, "usr-manager", "в заявке записан согласовавший");
});

test("setOrderPrice: обычный пользователь не может согласовать цену", async () => {
  admin = null;
  customer = { id: "usr-1", email: "user@test" };
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

// ---------------------------------------------------------------------------
// Блокировка заказа: зафиксированная цена неприкосновенна для всех,
// кроме основателя.
// ---------------------------------------------------------------------------

const LOCKED_ERROR = "Order is locked. Only Founder can edit.";

test("менеджер фиксирует цену и блокирует заказ одним действием", async () => {
  admin = { id: "usr-manager", email: "manager@test" };
  const id = seedOrder();

  const result = await setOrderPrice({ orderId: id, amountRub: "31000", lock: true });
  assert.equal(result.ok, true);

  const order = orders.get(id);
  assert.equal(order.total, 3_100_000);
  assert.equal(order.isLocked, true, "заказ заблокирован");
  assert.equal(order.lockedById, "usr-manager", "записан, кто заблокировал");
  assert.ok(logs.some((entry) => entry.action === "locked"), "блокировка попала в журнал");
});

test("заблокированный заказ нельзя переценить — ни менеджеру, ни админу", async () => {
  const id = seedOrder({ status: "awaiting_payment", total: 3_000_000, isLocked: true });

  admin = { id: "usr-manager", email: "manager@test" };
  const byManager = await setOrderPrice({ orderId: id, amountRub: "1000" });
  assert.equal(byManager.ok, false);
  assert.equal(byManager.error, LOCKED_ERROR);

  admin = { id: "usr-admin", email: "admin@test" };
  const byAdmin = await setOrderPrice({ orderId: id, amountRub: "1000" });
  assert.equal(byAdmin.ok, false, "обычный админ — не основатель");
  assert.equal(byAdmin.error, LOCKED_ERROR);

  assert.equal(orders.get(id).total, 3_000_000, "цена не изменилась");
});

test("основатель может редактировать заблокированный заказ", async () => {
  const id = seedOrder({ status: "awaiting_payment", total: 3_000_000, isLocked: true });
  admin = { id: "usr-founder", email: "founder@test", isFounder: true };

  const result = await setOrderPrice({ orderId: id, amountRub: "29000" });
  assert.equal(result.ok, true);
  assert.equal(orders.get(id).total, 2_900_000);
  assert.equal(orders.get(id).isLocked, true, "правка основателя блокировку не снимает");
});

test("статус заблокированного заказа менеджеру не поменять", async () => {
  const id = seedOrder({ status: "awaiting_payment", total: 3_000_000, isLocked: true });
  admin = { id: "usr-manager", email: "manager@test" };

  const result = await updateOrderStatus({ orderId: id, status: "cancelled" });
  assert.equal(result.ok, false);
  assert.equal(result.error, LOCKED_ERROR);
  assert.equal(orders.get(id).status, "awaiting_payment");
});

test("разблокировать заказ может только основатель", async () => {
  const id = seedOrder({ status: "awaiting_payment", total: 3_000_000, isLocked: true });

  admin = { id: "usr-manager", email: "manager@test" };
  const byManager = await setOrderLocked({ orderId: id, locked: false });
  assert.equal(byManager.ok, false, "менеджер не снимает собственный замок");
  assert.equal(orders.get(id).isLocked, true);

  admin = { id: "usr-founder", email: "founder@test", isFounder: true };
  const byFounder = await setOrderLocked({ orderId: id, locked: false });
  assert.equal(byFounder.ok, true);
  assert.equal(orders.get(id).isLocked, false);
  assert.equal(orders.get(id).lockedById, null);
});

test("заблокировать уже оценённый заказ может любой сотрудник", async () => {
  const id = seedOrder({ status: "awaiting_payment", total: 3_000_000, isLocked: false });
  admin = { id: "usr-manager", email: "manager@test" };

  const result = await setOrderLocked({ orderId: id, locked: true });
  assert.equal(result.ok, true);
  assert.equal(orders.get(id).isLocked, true);
});
