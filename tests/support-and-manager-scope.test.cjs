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

let customer;
let database;
let addressSequence = 10;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/cart") return { requireActiveCustomer: async () => customer };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name === "next/navigation") {
    return { redirect: (target) => { throw new Error(`redirect:${target}`); } };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { POST: postSupport } = require("../app/api/support/route.ts");
const { getOrders } = require("../lib/admin-queries.ts");

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

before(async () => {
  database = createTestDatabase("pip-support-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  customer = null;
  await database.reset();
  const now = new Date().toISOString();
  await database.exec(
    `insert into accounts (id, email, password_hash, role, is_blocked, created_at, updated_at)
     values ('customer-1', 'session@example.com', 'hash', 'USER', 0, ?, ?)`,
    [now, now],
  );
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price, price_type,
       currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
     values ('service-1', 'Sign Design', 'sign-design', 'small', 'Short', 'Full', 'Result', 100000, 'from',
       'RUB', 1, 1, 1, 0, ?, ?)`,
    [now, now],
  );
});

test("guest support requests are rejected without account or order creation", async () => {
  const response = await postSupport(supportRequest());
  assert.equal(response.status, 401);
  const orders = await database.rows("select id from orders");
  assert.deepEqual(orders, [], "a guest cannot create an order");
  const accounts = await database.rows("select id from accounts");
  assert.equal(accounts.length, 1, "support never creates accounts");
});

test("support links only to the authenticated customer and only eligible services", async () => {
  customer = { id: "customer-1", email: "session@example.com" };
  const response = await postSupport(supportRequest("somebody-else@example.com"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.orderNumber, /^ПИП-\d{6}$/);

  const order = await database.one("select id, user_id_id, status, estimated_amount, customer_note from orders");
  assert.equal(order.user_id_id, "customer-1", "the order belongs to the session, not to the typed email");
  assert.equal(order.status, "quote_requested");
  assert.equal(Number(order.estimated_amount), 100000);
  assert.match(String(order.customer_note), /somebody-else@example\.com/);

  const item = await database.one("select order_id_id, service_id_id, title, quantity from order_items");
  assert.equal(item.order_id_id, order.id);
  assert.equal(item.service_id_id, "service-1");
  assert.equal(item.title, "Sign Design");
  assert.equal(Number(item.quantity), 1);

  const link = await database.one("select order_id_id, service_id_id from order_services");
  assert.equal(link.service_id_id, "service-1");

  const activity = await database.one("select actor_id_id, entity_type, entity_id from activity_logs");
  assert.equal(activity.actor_id_id, "customer-1");
  assert.equal(activity.entity_type, "order");
  assert.equal(activity.entity_id, order.id);
});

test("an unpublished or inactive service never becomes an order line", async () => {
  customer = { id: "customer-1", email: "session@example.com" };
  await database.exec("update services set is_published = 0 where id = 'service-1'");
  const response = await postSupport(supportRequest());
  assert.equal(response.status, 200);
  const item = await database.one("select service_id_id, title from order_items");
  assert.equal(item.service_id_id, null, "the request is kept as a plain inquiry");
  assert.equal(item.title, "Sign Design", "the typed subject still labels the request");
  const links = await database.rows("select id from order_services");
  assert.deepEqual(links, []);
});

test("the manager board never lists carts or another customer's draft", async () => {
  const now = new Date().toISOString();
  await database.exec(
    `insert into orders (id, order_number, number, user_id_id, cart_key, status, created_at, updated_at)
     values ('cart-1', null, null, 'customer-1', 'customer-1', 'cart', ?, ?)`,
    [now, now],
  );
  await database.exec(
    `insert into orders (id, order_number, number, user_id_id, status, created_at, updated_at)
     values ('order-1', 'ПИП-000001', 'ПИП-000001', 'customer-1', 'quote_requested', ?, ?)`,
    [now, now],
  );
  const listed = await getOrders();
  assert.deepEqual(listed.map((row) => row.id), ["order-1"]);
  assert.equal(listed[0].customer, "", "an account without a name is not turned into a fake one");
});
