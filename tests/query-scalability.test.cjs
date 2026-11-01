const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createNativeModuleMock } = require("./helpers/native-payload-mock.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let queries;
let rawQueries;
const rows = (query, values) => { queries.push({ collection: query.collection, query }); return values.map((row) => structuredClone(row)); };
const db = {
  order: {
    findMany: async (query) => rows({ collection: "orders", ...query }, [
      { id: "ord-1", userId: "customer", number: "ПИП-000001", status: "pending", estimatedAmount: 100, total: 0, currency: "RUB", createdAt: new Date("2026-01-01") },
      { id: "ord-2", userId: "customer", number: "ПИП-000002", status: "paid", estimatedAmount: 200, total: 200, currency: "RUB", createdAt: new Date("2026-01-02") },
    ]),
  },
  orderItem: {
    findMany: async (query) => rows({ collection: "order-items", ...query }, [
      { id: "item-1", orderId: "ord-1", itemType: "service", itemId: "svc", title: "Sign", quantity: 1, estimatedUnitPrice: 100 },
      { id: "item-2", orderId: "ord-2", itemType: "service", itemId: "svc", title: "Sign", quantity: 1, estimatedUnitPrice: 200 },
    ]),
  },
  orderService: { findMany: async (query) => rows({ collection: "order-services", ...query }, []) },
  payment: { findMany: async (query) => rows({ collection: "payments", ...query }, []) },
  queryRaw: async (sql, args) => { rawQueries.push({ sql, args }); return [{ queue: 3, revenue: 5000, paidCount: 2 }]; },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-native") return createNativeModuleMock(db);
  if (name === "@/auth") return { auth: async () => ({ user: { id: "customer" } }) };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { getCustomerOrders } = require("../lib/customer-orders.ts");
const { getOrderStats } = require("../lib/admin-analytics.ts");

beforeEach(() => { queries = []; rawQueries = []; });

test("customer orders use four bounded native reads regardless of order count", async () => {
  const result = await getCustomerOrders();
  assert.equal(result.length, 2);
  assert.deepEqual(queries.map((entry) => entry.collection), ["orders", "order-items", "order-services", "payments"]);
  for (const entry of queries.slice(1)) {
    assert.equal(entry.query.where.orderId.in.length, 2);
  }
  assert.equal(result[0].items.length + result[1].items.length, 2, "no per-order item query");
});

test("order revenue and queue metrics are one database aggregate, not a payment history scan", async () => {
  const stats = await getOrderStats();
  assert.deepEqual(stats, { queue: 3, revenue: 5000, paidCount: 2, averageOrder: 2500 });
  assert.equal(rawQueries.length, 1);
  assert.match(rawQueries[0].sql, /COALESCE\(SUM\(amount\), 0\)/);
  assert.match(rawQueries[0].sql, /EXISTS/);
  assert.equal(queries.length, 0);
});

test("Payload dashboard keeps recent lists bounded and projected", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "payload", "components", "dashboard-overview.tsx"), "utf8");
  assert.match(source, /collection: "orders",[\s\S]*?limit: 5/);
  assert.match(source, /collection: "activity-logs",[\s\S]*?limit: 5/);
  assert.match(source, /select: \{ number: true, orderNumber: true, status: true, total: true \}/);
  assert.doesNotMatch(source, /admin-orders|admin-data|skip:|take:/);
});
