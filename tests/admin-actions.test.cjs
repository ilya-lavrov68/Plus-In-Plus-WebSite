const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let invoiceCalls;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payments/invoice") return {
    issueInvoice: async (...args) => {
      invoiceCalls.push(args);
      return { paymentId: "pay-native", paymentUrl: null, invId: 99000 };
    },
  };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const {
  activityAfterChange,
  distributeOrderPrice,
  prepareOrder,
  preparePost,
  prepareService,
  protectServiceDeletion,
  protectServicePricing,
  syncFeaturedPost,
} = require("../payload/hooks.ts");

beforeEach(() => { invoiceCalls = []; });

function staff(role = "ADMIN") {
  return { id: `staff-${role.toLowerCase()}`, collection: "accounts", role };
}
function request(user) {
  const actor = typeof user === "string" ? staff(user) : user === undefined ? staff() : user;
  return { user: actor, context: {}, payload: {} };
}

test("legacy content actions stay removed while Payload owns the only staff panel", () => {
  for (const file of ["app/actions/services.ts", "app/actions/posts.ts", "app/actions/story.ts"]) {
    assert.equal(fs.existsSync(path.join(__dirname, "..", file)), false, file);
  }
  assert.equal(fs.existsSync(path.join(__dirname, "..", "app", "(payload)", "admin", "[[...segments]]", "page.tsx")), true);
});

test("preparePost sets publication time once and preserves an explicit date", async () => {
  const created = await preparePost({ data: { isPublished: true } });
  assert.ok(Number.isFinite(new Date(created.publishedAt).getTime()));
  const explicit = "2026-01-02T03:04:05.000Z";
  const preserved = await preparePost({ data: { isPublished: true, publishedAt: explicit } });
  assert.equal(preserved.publishedAt, explicit);
  const draft = await preparePost({ data: { isPublished: false } });
  assert.equal(draft.publishedAt, undefined);
});

test("syncFeaturedPost atomically clears competitors and rejects unpublished features", async () => {
  const updates = [];
  const req = {
    context: {},
    payload: { update: async (options) => { updates.push(options); return { docs: [{}] }; } },
  };
  const doc = { id: "post-new", isFeatured: true, isPublished: true, publishedAt: "2026-01-01T00:00:00.000Z" };
  await syncFeaturedPost({ doc, req });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].collection, "posts");
  assert.deepEqual(updates[0].data, { isFeatured: false });
  assert.deepEqual(updates[0].context, { skipFeaturedSync: true });
  assert.equal(updates[0].where.and[0].id.not_equals, doc.id);

  await assert.rejects(
    syncFeaturedPost({ doc: { ...doc, isPublished: false }, req }),
    /только опубликованный материал/,
  );
  assert.equal(updates.length, 1, "invalid feature does not write");
});

test("activityAfterChange records staff operations without acting as anonymous server jobs", async () => {
  const writes = [];
  const hook = activityAfterChange("service", "title");
  const req = { user: staff(), payload: { create: async (options) => { writes.push(options); return {}; } } };
  await hook({ doc: { id: "svc-1", title: "Sign" }, operation: "update", req });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].collection, "activity-logs");
  assert.equal(writes[0].data.action, "updated");
  assert.equal(writes[0].data.actorId, req.user.id);
  await hook({ doc: { id: "svc-2", title: "Public" }, operation: "update", req: { ...req, user: null } });
  assert.equal(writes.length, 1);
});

test("service deletion is blocked only while a submitted order is still active", async () => {
  let active = 1;
  const req = {
    payload: {
      find: async ({ collection }) => ({ docs: collection === "order-items" ? [{ orderId: "ord-active" }] : [] }),
      count: async () => ({ totalDocs: active }),
    },
  };
  await assert.rejects(protectServiceDeletion({ id: "svc-1", req }), /активными заказами/);
  active = 0;
  await protectServiceDeletion({ id: "svc-1", req });
});

test("quote services stay request-only and active orders freeze native pricing edits", async () => {
  const quote = await prepareService({ data: { priceType: "quote", isOrderable: true } });
  assert.equal(quote.isOrderable, false);

  let active = 1;
  const req = request("ADMIN");
  req.payload.find = async () => ({ docs: [{ orderId: "ord-active" }] });
  req.payload.count = async () => ({ totalDocs: active });
  const originalDoc = { id: "svc-1", basePrice: 1000, priceType: "fixed", currency: "RUB", optionGroups: [] };
  await assert.rejects(protectServicePricing({
    operation: "update", originalDoc, data: { basePrice: 2000 }, req,
  }), /активными заказами/);
  const unchanged = await protectServicePricing({
    operation: "update", originalDoc, data: { title: "Renamed", optionGroups: [] }, req,
  });
  assert.equal(unchanged.title, "Renamed");
  active = 0;
  const changed = await protectServicePricing({ operation: "update", originalDoc, data: { basePrice: 2000 }, req });
  assert.equal(changed.basePrice, 2000);
});

test("staff cannot turn a customer cart into an admin order; native customer checkout still can", async () => {
  const args = {
    operation: "update",
    originalDoc: { id: "ord-cart", status: "cart" },
    data: { status: "pending" },
  };
  await assert.rejects(prepareOrder({ ...args, req: request() }), /Корзина редактируется только клиентским сценарием/);
  const result = await prepareOrder({ ...args, req: request(null) });
  assert.equal(result.status, "pending");
});

test("order locks and payment-gated transitions survive in native Payload hooks", async () => {
  const locked = { id: "ord-1", status: "awaiting_payment", isLocked: true, finalPrice: 30000 };
  await assert.rejects(prepareOrder({
    operation: "update", originalDoc: locked, data: { finalPrice: 1000 }, req: request("ADMIN"),
  }), /только основатель/);
  await assert.rejects(prepareOrder({
    operation: "update", originalDoc: locked, data: { isLocked: false }, req: request("MANAGER"),
  }), /Снять блокировку/);

  const founderReq = request("FOUNDER");
  const unlocked = await prepareOrder({ operation: "update", originalDoc: locked, data: { isLocked: false }, req: founderReq });
  assert.equal(unlocked.isLocked, false);
  assert.equal(unlocked.lockedAt, null);
  assert.equal(unlocked.lockedById, null);

  const statusReq = request("MANAGER");
  statusReq.payload.count = async () => ({ totalDocs: 0 });
  await assert.rejects(prepareOrder({
    operation: "update", originalDoc: { id: "ord-2", status: "paid" }, data: { status: "in_progress" }, req: statusReq,
  }), /нужен успешный платёж/);
  statusReq.payload.count = async () => ({ totalDocs: 1 });
  const started = await prepareOrder({
    operation: "update", originalDoc: { id: "ord-2", status: "paid" }, data: { status: "in_progress" }, req: statusReq,
  });
  assert.equal(started.status, "in_progress");
  await assert.rejects(prepareOrder({
    operation: "update", originalDoc: { id: "ord-2", status: "awaiting_payment" }, data: { status: "paid" }, req: statusReq,
  }), /только webhook Robokassa/);
});

test("native price hook keeps exact totals, distributes rounding remainder and issues one invoice", async () => {
  const req = request("MANAGER");
  req.payload.count = async () => ({ totalDocs: 0 });
  const originalDoc = { id: "ord-price", status: "quote_requested", finalPrice: null, isLocked: false };
  const data = await prepareOrder({ operation: "update", originalDoc, data: { finalPrice: 10.01 }, req });
  assert.equal(data.total, 1001);
  assert.equal(data.subtotal, 1001);
  assert.equal(data.status, "awaiting_payment");
  assert.equal(data.managerId, req.user.id);
  assert.deepEqual(req.context.distributeOrderPrice, { orderId: "ord-price", total: 1001 });

  const updates = [];
  req.payload.find = async () => ({ docs: [
    { id: "item-a", estimatedUnitPrice: 500, quantity: 1 },
    { id: "item-b", estimatedUnitPrice: 500, quantity: 1 },
  ] });
  req.payload.update = async (options) => { updates.push(options); return {}; };
  const doc = { id: "ord-price", number: "ПИП-000099", currency: "RUB", userId: { email: "customer@example.test" } };
  await distributeOrderPrice({ doc, req });
  assert.deepEqual(updates.map((entry) => entry.data.totalPrice), [501, 500]);
  assert.equal(updates.reduce((sum, entry) => sum + entry.data.totalPrice, 0), 1001);
  assert.equal(req.context.distributeOrderPrice, undefined);
  assert.equal(invoiceCalls.length, 1);
  assert.equal(invoiceCalls[0][0].amount, 1001);
  assert.equal(invoiceCalls[0][0].customerEmail, "customer@example.test");
  assert.equal(invoiceCalls[0][2], req, "invoice shares the order transaction");
});
