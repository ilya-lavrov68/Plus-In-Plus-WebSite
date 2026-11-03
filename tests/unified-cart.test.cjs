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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );

let currentUser = null;
let database;

const SERVICE = {
  id: "svc-sign",
  title: "Sign Design",
  slug: "sign-design",
  shortDesc: "Custom exterior signage",
  category: "small",
  coverImage: "/assets/shop/sign-design.jpg",
  basePrice: 500_000, // 5 000 ₽ в копейках
};
const PRODUCT = {
  id: "prd-hoodie",
  name: "PIP Studio Hoodie",
  slug: "pip-studio-hoodie",
  description: "Heavyweight cotton hoodie",
  price: 4500, // 4 500 ₽
  coverImage: "/assets/shop/bag-design.jpg",
  category: "apparel",
  stock: 15,
};

async function resetStore() {
  await database.reset();
  await database.insertAccount({
    id: "usr-1",
    email: "client@example.com",
    firstName: "Ivan",
    lastName: "Petrov",
      role: "USER",
    isBlocked: false,
  });
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, cover_image,
       base_price, price_type, currency, is_orderable, is_published, is_active, sort_order)
     values (?, ?, ?, ?, ?, '', '', ?, ?, 'from', 'RUB', 1, 1, 1, 0)`,
    [SERVICE.id, SERVICE.title, SERVICE.slug, SERVICE.category, SERVICE.shortDesc, SERVICE.coverImage, SERVICE.basePrice]
  );
  await database.exec(
    `insert into products (id, name, slug, description, price, cover_image, category, is_active, stock)
     values (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [PRODUCT.id, PRODUCT.name, PRODUCT.slug, PRODUCT.description, PRODUCT.price, PRODUCT.coverImage, PRODUCT.category, PRODUCT.stock]
  );
}

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name === "@/auth") {
    return { auth: async () => (currentUser ? { user: currentUser } : null) };
  }
  if (name === "@/lib/request-locale") return { getRequestLocale: async () => "en" };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const cartGetRoute = require("../app/api/cart/route.ts");
const cartItemRoute = require("../app/api/cart/item/route.ts");
const cartCheckoutRoute = require("../app/api/cart/checkout/route.ts");
const cartCountRoute = require("../app/api/cart/count/route.ts");
const { getCustomerOrders } = require("../lib/customer-orders.ts");

function apiRequest(url, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("origin")) headers.set("origin", new URL(url).origin);
  return new Request(url, { ...init, headers });
}

function postItem(body) {
  return cartItemRoute.POST(
    apiRequest("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function checkout(body = {}) {
  return cartCheckoutRoute.POST(
    apiRequest("http://localhost/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const orderRows = () => database.rows("select id, status, cart_key, order_number from orders order by created_at");
const itemRows = () => database.rows("select id, quantity from order_items");

before(async () => {
  database = createTestDatabase("pip-cart-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  await resetStore();
  currentUser = { id: "usr-1", email: "client@example.com", role: "USER" };
});

test("единая схема описывает корзину и типизированные позиции заказа", () => {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  assert.doesNotMatch(schema, /`cart_items`/, "позиции корзины не дублируют order_items");
  assert.match(
    schema,
    /CREATE TABLE `orders` \([\s\S]*?`status` text DEFAULT 'cart' NOT NULL/,
    "заказ со статусом cart и есть корзина",
  );
  assert.match(schema, /CREATE UNIQUE INDEX `orders_order_number_idx`/);
  assert.match(schema, /CREATE UNIQUE INDEX `orders_cart_key_idx`/);
  assert.match(schema, /`item_type` text DEFAULT 'service' NOT NULL/);
  assert.match(schema, /`item_id` text DEFAULT '' NOT NULL/);

  const cartTypes = fs.readFileSync(path.join(__dirname, "..", "lib", "cart.ts"), "utf8");
  assert.match(cartTypes, /export type CartItemType = "service" \| "product"/);

  const profileFormSrc = fs.readFileSync(path.join(__dirname, "..", "components", "site", "profile-form.tsx"), "utf8");
  assert.doesNotMatch(profileFormSrc, /\/orders/);
});

test("unified cart stores both services and products in one Order (status='cart') and checks out to status='pending'", async () => {
  currentUser = null;
  assert.equal((await cartGetRoute.GET()).status, 401);

  currentUser = { id: "usr-1", email: "client@example.com", role: "USER" };

  assert.equal((await postItem({ itemType: "service", itemId: SERVICE.id, quantity: 1 })).status, 200);
  assert.equal((await postItem({ itemType: "product", itemId: PRODUCT.id, quantity: 2 })).status, 200);

  const drafts = await orderRows();
  assert.equal(drafts.length, 1, "услуга и товар живут в одном заказе-корзине");
  assert.equal(drafts[0].status, "cart");
  assert.equal(drafts[0].cart_key, "usr-1");
  assert.equal(drafts[0].order_number, null);

  assert.equal((await getCustomerOrders()).length, 0, "корзина не попадает в список заказов");

  const cartPayload = await (await cartGetRoute.GET()).json();
  assert.equal(cartPayload.items.length, 2);
  assert.equal(cartPayload.count, 3);

  const svcLine = cartPayload.items.find((item) => item.itemType === "service");
  const prdLine = cartPayload.items.find((item) => item.itemType === "product");
  assert.equal(svcLine.name, "Sign Design");
  assert.equal(svcLine.price, 5000);
  assert.equal(svcLine.unavailable, false);
  assert.equal(svcLine.maxQuantity, 99);
  assert.equal(prdLine.name, "PIP Studio Hoodie");
  assert.equal(prdLine.price, 4500);
  assert.equal(prdLine.quantity, 2);
  assert.equal(prdLine.unavailable, false);
  assert.equal(prdLine.maxQuantity, 15);

  assert.equal((await (await cartCountRoute.GET()).json()).count, 3);

  const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
  const checkoutResponse = await checkout({ deadline: futureDate, description: "Storefront sign + 2 studio hoodies" });
  assert.equal(checkoutResponse.status, 200);
  const checkoutData = await checkoutResponse.json();
  assert.equal(checkoutData.success, true);
  assert.equal(checkoutData.orderNumber, "ПИП-000001");

  const submitted = await orderRows();
  assert.equal(submitted.length, 1, "статус меняется на месте, второй заказ не создаётся");
  assert.equal(submitted[0].id, drafts[0].id);
  assert.equal(submitted[0].status, "pending");
  assert.equal(submitted[0].cart_key, null);
  assert.equal(submitted[0].order_number, "ПИП-000001");

  assert.equal((await (await cartCountRoute.GET()).json()).count, 0);

  const orders = await getCustomerOrders();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].orderNumber, "ПИП-000001");
  assert.equal(orders[0].status, "pending");
  assert.equal(orders[0].items.length, 2);
});

test("concurrent first cart writes converge on one cart and checkout releases its unique key", async () => {
  const [serviceResponse, productResponse] = await Promise.all([
    postItem({ itemType: "service", itemId: SERVICE.id, quantity: 1 }),
    postItem({ itemType: "product", itemId: PRODUCT.id, quantity: 1 }),
  ]);
  assert.equal(serviceResponse.status, 200);
  assert.equal(productResponse.status, 200);

  const drafts = await orderRows();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].cart_key, "usr-1");
  const firstCartId = drafts[0].id;

  assert.equal((await checkout({})).status, 200);
  assert.equal((await database.one("select cart_key from orders where id = ?", [firstCartId])).cart_key, null);

  assert.equal((await cartGetRoute.GET()).status, 200);
  const afterCheckout = await orderRows();
  assert.equal(afterCheckout.length, 2, "после оформления заводится новая корзина");
  const activeCarts = afterCheckout.filter((order) => order.status === "cart");
  assert.equal(activeCarts.length, 1);
  assert.equal(activeCarts[0].cart_key, "usr-1");
  assert.notEqual(activeCarts[0].id, firstCartId);
});

test("configured service lines keep immutable identities for independent update and delete", async () => {
  await database.exec(
    `insert into services_option_groups (_order, _parent_id, id, name, required, sort_order)
     values (0, ?, 'group-finish', 'Finish', 0, 0)`,
    [SERVICE.id]
  );
  await database.exec(
    `insert into services_option_groups_options (_order, _parent_id, id, label, price_delta, price_factor, is_default, sort_order)
     values (0, 'group-finish', 'option-matte', 'Matte', 0, 1, 1, 0),
            (1, 'group-finish', 'option-gloss', 'Gloss', 10000, 1, 0, 1)`
  );

  for (const optionIds of [["option-matte"], ["option-gloss"]]) {
    const response = await postItem({ itemType: "service", itemId: SERVICE.id, optionIds });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  }

  const rows = await itemRows();
  assert.equal(rows.length, 2, "разные конфигурации — разные строки заказа");

  const payload = await (await cartGetRoute.GET()).json();
  const [first, second] = payload.items;
  assert.notEqual(first.id, second.id);

  const update = await cartItemRoute.PATCH(
    apiRequest("http://localhost/api/cart/item", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: first.id, quantity: 3 }),
    })
  );
  assert.equal(update.status, 200);
  assert.equal((await database.one("select quantity from order_items where id = ?", [first.id])).quantity, 3);
  assert.equal((await database.one("select quantity from order_items where id = ?", [second.id])).quantity, 1);

  const remove = await cartItemRoute.DELETE(
    apiRequest("http://localhost/api/cart/item", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: second.id }),
    })
  );
  assert.equal(remove.status, 200);
  assert.equal(await database.one("select id from order_items where id = ?", [first.id]) !== null, true);
  assert.equal(await database.one("select id from order_items where id = ?", [second.id]), null);
});

test("direct cart mutations reject unavailable services and excess product stock", async () => {
  await database.exec("update services set is_published = 0 where id = ?", [SERVICE.id]);
  assert.equal((await postItem({ itemType: "service", itemId: SERVICE.id })).status, 400);

  await database.exec("update services set is_published = 1, is_orderable = 0 where id = ?", [SERVICE.id]);
  assert.equal((await postItem({ itemType: "service", itemId: SERVICE.id })).status, 400);

  await database.exec("update services set is_orderable = 1 where id = ?", [SERVICE.id]);
  assert.equal((await postItem({ itemType: "product", itemId: PRODUCT.id, quantity: 16 })).status, 400);
  assert.equal((await itemRows()).length, 0);
});

test("existing cart lines expose stale catalog eligibility and cannot be checked out", async () => {
  assert.equal((await postItem({ itemType: "service", itemId: SERVICE.id })).status, 200);
  await database.exec("update services set is_published = 0 where id = ?", [SERVICE.id]);

  const payload = await (await cartGetRoute.GET()).json();
  assert.equal(payload.items[0].unavailable, true);

  assert.equal((await checkout({})).status, 400);
  assert.equal((await orderRows())[0].status, "cart");
});

test("DELETE /api/cart/item removes individual item and checkout rejects empty cart", async () => {
  assert.equal((await postItem({ itemType: "service", itemId: SERVICE.id })).status, 200);

  const cartPayload = await (await cartGetRoute.GET()).json();
  const line = cartPayload.items.find((item) => item.itemId === SERVICE.id);
  assert.ok(line?.id, "API отдаёт неизменяемый id позиции");

  const remove = await cartItemRoute.DELETE(
    apiRequest("http://localhost/api/cart/item", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: line.id }),
    })
  );
  assert.equal(remove.status, 200);
  assert.equal((await itemRows()).length, 0);

  assert.equal((await checkout({})).status, 400);
});
