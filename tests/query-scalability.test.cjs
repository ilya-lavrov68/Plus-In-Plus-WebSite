const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};

let orderFindMany;
let serviceFindMany;
let userFindMany;
const db = {
  order: {
    count: async () => 120,
    findMany: async (query) => { orderFindMany = query; return []; },
  },
  service: {
    findMany: async (query) => { serviceFindMany = query; return [{ id: "svc-current" }]; },
    count: async () => 1,
  },
  orderService: {
    groupBy: async () => [{ serviceId: "svc-current", orderId: "ord-shared" }],
  },
  orderItem: {
    groupBy: async () => [
      { serviceId: "svc-current", orderId: "ord-shared" },
      { serviceId: "svc-current", orderId: "ord-second" },
    ],
  },
  user: {
    findMany: async (query) => {
      userFindMany = query;
      return [
        { id: "user-1", activities: [{ id: "activity-1" }] },
        { id: "user-2", activities: [] },
      ];
    },
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-db") return { db };
  if (name === "@/lib/admin-session") return {
    requireAdmin: async () => ({ id: "admin", role: "ADMIN" }),
    requireStaff: async () => ({ id: "admin", role: "ADMIN" }),
    requireFounder: async () => ({ id: "founder", role: "FOUNDER" }),
  };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { getAdminOrdersPage } = require("../lib/admin-orders.ts");
const { getAllServicesWithActiveOrders, getUserActivities } = require("../lib/admin-data.ts");

beforeEach(() => {
  orderFindMany = null;
  serviceFindMany = null;
  userFindMany = null;
});

test("order pages use stable bounded offsets and retain access to every page", async () => {
  const result = await getAdminOrdersPage(2);
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 3);
  assert.equal(result.total, 120);
  assert.equal(orderFindMany.skip, 50);
  assert.equal(orderFindMany.take, 50);
  assert.deepEqual(orderFindMany.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});

test("service active-order badges use distinct grouped orders instead of unbounded relation reads", async () => {
  const services = await getAllServicesWithActiveOrders(1);
  assert.equal(serviceFindMany.take, 50);
  assert.equal(services[0].activeOrderCount, 2, "legacy and unified links to one order count once");
});

test("user history uses per-user relation pagination without an N+1 loop", async () => {
  const result = await getUserActivities(["user-1", "user-2", "user-3"]);
  assert.equal(userFindMany.select.activities.take, 50);
  assert.deepEqual(userFindMany.where, { id: { in: ["user-1", "user-2", "user-3"] } });
  assert.deepEqual(result["user-1"], [{ id: "activity-1" }]);
  assert.deepEqual(result["user-2"], []);
  assert.deepEqual(result["user-3"], []);
});
