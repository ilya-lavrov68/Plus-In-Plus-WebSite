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

let admin;
let database;
let invalidated;
let redirects;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return {
      requireAdmin: async () => admin,
      requireStaff: async () => (admin ? { ...admin, isAdmin: true } : null),
    };
  }
  if (name === "next/cache") return { revalidatePath: (url) => invalidated.push(url) };
  if (name === "next/navigation") {
    return {
      redirect: (url) => {
        redirects.push(url);
        const error = new Error(`redirect:${url}`);
        error.digest = `NEXT_REDIRECT;replace;${url};307;`;
        throw error;
      },
      notFound: () => {
        throw new Error("notFound");
      },
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { saveProduct } = require("../app/(admin)/admin/products/actions.ts");
const { updateProduct } = require("../lib/product-rules.ts");

const now = () => new Date().toISOString();

async function insertProduct(overrides = {}) {
  const product = {
    id: "prd-1",
    name: "Hoodie",
    slug: "hoodie",
    description: "Heavyweight",
    price: 4500,
    stock: 10,
    category: "apparel",
    isActive: true,
    ...overrides,
  };
  await database.exec(
    `insert into products (id, name, slug, description, price, stock, category, is_active, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.name,
      product.slug,
      product.description,
      product.price,
      product.stock,
      product.category,
      product.isActive ? 1 : 0,
      now(),
      now(),
    ],
  );
  return product;
}

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

before(async () => {
  database = createTestDatabase("pip-products-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from products`);
  await database.exec(`delete from activity_logs`);
  await database.exec(`delete from accounts`);
  invalidated = [];
  redirects = [];
  admin = { id: "usr-admin", email: "admin@example.com", role: "ADMIN", isFounder: false };
  await database.exec(
    `insert or ignore into accounts (id, email, role, is_blocked, created_at, updated_at)
     values ('usr-admin', 'admin@example.com', 'ADMIN', 0, ?, ?)`,
    [now(), now()],
  );
});

after(async () => {
  await database.close();
});

test("updateProduct writes name, slug, price in rubles and stock", async () => {
  await insertProduct();
  await updateProduct({
    id: "prd-1",
    name: "Hoodie Deluxe",
    slug: "Hoodie Deluxe!",
    description: null,
    price: 5200,
    stock: 3,
    category: "apparel",
    isActive: false,
  });

  const [row] = await database.rows(
    `select name, slug, description, price, stock, is_active from products where id = 'prd-1'`,
  );
  assert.equal(row.name, "Hoodie Deluxe");
  assert.equal(row.slug, "hoodie-deluxe");
  assert.equal(row.description, null);
  assert.equal(Number(row.price), 5200, "product prices stay in rubles");
  assert.equal(Number(row.stock), 3);
  assert.equal(Number(row.is_active), 0);
});

test("updateProduct rejects out-of-range price and stock", async () => {
  await insertProduct();
  await assert.rejects(() => updateProduct({ id: "prd-1", name: "X", slug: "x", description: null, price: -1, stock: 1, category: null, isActive: true }), /Цена/);
  await assert.rejects(() => updateProduct({ id: "prd-1", name: "X", slug: "x", description: null, price: 10, stock: 1.5, category: null, isActive: true }), /Остаток/);
  await assert.rejects(() => updateProduct({ id: "missing", name: "X", slug: "x", description: null, price: 10, stock: 1, category: null, isActive: true }), /не найден/);
});

test("saveProduct is silent for a non-admin staff session", async () => {
  await insertProduct();
  admin = null;
  await saveProduct(form({ id: "prd-1", name: "Hacked", price: 1, stock: 0 }));
  const [row] = await database.rows(`select name, price from products where id = 'prd-1'`);
  assert.equal(row.name, "Hoodie");
  assert.equal(Number(row.price), 4500);
  assert.deepEqual(redirects, []);
});

test("saveProduct stores the product, logs it and revalidates the shop", async () => {
  await insertProduct();
  await assert.rejects(
    () =>
      saveProduct(
        form({
          id: "prd-1",
          name: "Hoodie",
          slug: "hoodie",
          description: "Heavyweight",
          price: 4900,
          stock: 7,
          category: "apparel",
          isActive: "on",
        }),
      ),
    /redirect:\/admin\/products\/prd-1\?saved=1/,
  );

  const [row] = await database.rows(`select price, stock, is_active from products where id = 'prd-1'`);
  assert.equal(Number(row.price), 4900);
  assert.equal(Number(row.stock), 7);
  assert.equal(Number(row.is_active), 1);

  const [log] = await database.rows(`select action, actor_id_id from activity_logs where entity_id = 'prd-1'`);
  assert.equal(log.action, "product.updated");
  assert.equal(log.actor_id_id, "usr-admin");
  for (const url of ["/admin/products", "/shop"]) {
    assert.ok(invalidated.includes(url), `${url} must be revalidated`);
  }
});
