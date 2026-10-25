const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let customer;
let staff;
let orders;
let activities;
let userCreates;
let serviceWhere;
let userDirectoryQuery;
let addressSequence = 10;

const prisma = {
  user: {
    findMany: async (query) => {
      userDirectoryQuery = query;
      return [{ id: "customer-1", email: "customer@example.com", firstName: "Test", lastName: "Customer", createdAt: new Date("2026-01-01"), _count: { orders: 3 } }];
    },
    create: async () => { userCreates += 1; throw new Error("support must never create accounts"); },
  },
  service: {
    findFirst: async ({ where }) => {
      serviceWhere = where;
      return { id: "service-1", title: "Sign Design", basePrice: 1000, currency: "RUB", isActive: true, isPublished: true };
    },
  },
  order: {
    count: async () => 0,
    create: async ({ data }) => { orders.push(structuredClone(data)); return { id: "order-1", ...data }; },
  },
  activityLog: {
    create: async ({ data }) => { activities.push(structuredClone(data)); return data; },
  },
  $transaction: async (callback) => callback(prisma),
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/cart") return { requireActiveCustomer: async () => customer };
  if (name === "@/lib/admin-session") return {
    requireStaff: async () => staff,
    requireAdmin: async () => null,
    requireFounder: async () => null,
  };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name === "next/navigation") return { redirect: (target) => { throw new Error(`redirect:${target}`); } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { POST: postSupport } = require("../app/api/support/route.ts");
const { getStaffUserDirectory } = require("../lib/admin-data.ts");

function supportRequest(email = "form@example.com") {
  return new Request("http://localhost/api/support", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost",
      "x-real-ip": `198.51.100.${addressSequence++}`,
    },
    body: JSON.stringify({
      firstName: "Form",
      lastName: "Sender",
      email,
      subject: "Sign Design",
      serviceId: "service-1",
      message: "Please discuss this project.",
    }),
  });
}

beforeEach(() => {
  customer = null;
  staff = { id: "manager-1", role: "MANAGER" };
  orders = [];
  activities = [];
  userCreates = 0;
  serviceWhere = null;
  userDirectoryQuery = null;
});

test("guest support requests are rejected without account or order creation", async () => {
  const response = await postSupport(supportRequest());
  assert.equal(response.status, 401);
  assert.equal(orders.length, 0);
  assert.equal(userCreates, 0);
  assert.equal(serviceWhere, null);
});

test("support links only to the authenticated customer and only eligible services", async () => {
  customer = { id: "session-customer", email: "session@example.com" };
  const response = await postSupport(supportRequest("somebody-else@example.com"));
  assert.equal(response.status, 200);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].userId, "session-customer");
  assert.equal(activities[0].actorId, "session-customer");
  assert.equal(userCreates, 0);
  assert.equal(serviceWhere.isActive, true);
  assert.equal(serviceWhere.isPublished, true);
  assert.equal(orders[0].items.create.itemId, "service-1");
});

test("manager customer directory is restricted to USER accounts with non-cart orders", async () => {
  const customers = await getStaffUserDirectory();
  assert.equal(userDirectoryQuery.where.role, "USER");
  assert.deepEqual(userDirectoryQuery.where.orders, { some: { status: { not: "cart" } } });
  assert.equal(userDirectoryQuery.select.role, undefined);
  assert.equal(userDirectoryQuery.select.passwordHash, undefined);
  assert.equal(customers[0].orderCount, 3);
  assert.equal(customers[0]._count, undefined);
});
