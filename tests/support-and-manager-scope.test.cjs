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

let customer;
let staff;
let orders;
let activities;
let userCreates;
let serviceWhere;
let orderItems;
let orderServices;
let addressSequence = 10;

const db = {
  user: {
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
  orderItem: {
    create: async ({ data }) => { orderItems.push(structuredClone(data)); return { id: "item-1", ...data }; },
  },
  orderService: {
    create: async ({ data }) => { orderServices.push(structuredClone(data)); return { id: "link-1", ...data }; },
  },
  activityLog: {
    create: async ({ data }) => { activities.push(structuredClone(data)); return data; },
  },
  transaction: async (callback) => callback(db),
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-native") return createNativeModuleMock(db);
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
const { readAccounts, readSubmittedOrders } = require("../payload/access.ts");

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
  orderItems = [];
  orderServices = [];
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
  assert.equal(orderItems[0].itemId, "service-1");
  assert.equal(orderItems[0].orderId, "order-1");
  assert.equal(orderServices[0].serviceId, "service-1");
});

test("manager Payload scope excludes the customer directory and every cart", () => {
  const manager = { req: { user: { id: "manager-1", collection: "accounts", role: "MANAGER" } } };
  const admin = { req: { user: { id: "admin-1", collection: "accounts", role: "ADMIN" } } };
  assert.equal(readAccounts(manager), false);
  assert.equal(readAccounts(admin), true);
  assert.deepEqual(readSubmittedOrders(manager), { status: { not_equals: "cart" } });
  assert.deepEqual(readSubmittedOrders(admin), { status: { not_equals: "cart" } });
  assert.equal(readSubmittedOrders({ req: { user: null } }), false);
});
