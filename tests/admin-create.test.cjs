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
let redirects;
let invalidated;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return { requireAdmin: async () => admin, requireStaff: async () => admin };
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
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const serviceActions = require("../app/(admin)/admin/services/actions.ts");
const postActions = require("../app/(admin)/admin/posts/actions.ts");
const productActions = require("../app/(admin)/admin/products/actions.ts");
const { insertService } = require("../lib/service-rules.ts");
const { insertPost } = require("../lib/post-rules.ts");
const { insertProduct } = require("../lib/product-rules.ts");

const now = () => new Date().toISOString();

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

before(async () => {
  database = createTestDatabase("pip-create-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from services`);
  await database.exec(`delete from posts`);
  await database.exec(`delete from products`);
  await database.exec(`delete from activity_logs`);
  await database.exec(`delete from accounts`);
  await database.exec(
    `insert into accounts (id, email, role, is_blocked, created_at, updated_at) values ('usr-admin', 'a@example.com', 'ADMIN', 0, ?, ?)`,
    [now(), now()],
  );
  admin = { id: "usr-admin", email: "a@example.com", role: "ADMIN", isFounder: false };
  redirects = [];
  invalidated = [];
});

after(async () => {
  await database.close();
});

test("insertService stores kopecks, derives the slug and keeps 'quote' unorderable", async () => {
  const id = await insertService({
    title: "Баннер на фасад!",
    category: "large",
    shortDesc: "Кратко",
    fullDesc: "Полностью",
    basePrice: 12500,
    priceType: "quote",
    isPublished: true,
    isActive: true,
    sortOrder: 3,
  });

  const [row] = await database.rows(`select * from services where id = ?`, [id]);
  assert.equal(row.title, "Баннер на фасад!");
  assert.equal(row.slug, "banner-na-fasad", "Cyrillic titles are transliterated into ASCII slugs");
  assert.equal(Number(row.base_price), 1250000, "prices live in kopecks");
  assert.equal(Number(row.is_orderable), 0, "'on request' services are never ordered directly");
  assert.equal(Number(row.is_published), 1);
  assert.equal(Number(row.sort_order), 3);
  assert.equal(row.result_text, "", "result_text is required by the schema");
});

test("insertService and insertProduct resolve duplicate slugs instead of failing", async () => {
  const first = await insertService({
    title: "Визитка",
    category: "small",
    shortDesc: "",
    fullDesc: "",
    basePrice: 100,
    priceType: "from",
    isPublished: false,
    isActive: true,
    sortOrder: 0,
  });
  const second = await insertService({
    title: "Визитка",
    category: "small",
    shortDesc: "",
    fullDesc: "",
    basePrice: 100,
    priceType: "from",
    isPublished: false,
    isActive: true,
    sortOrder: 0,
  });
  const slugs = await database.rows(`select slug from services where id in (?, ?) order by slug`, [first, second]);
  assert.deepEqual(
    slugs.map((row) => row.slug),
    ["vizitka", "vizitka-2"],
  );

  const productA = await insertProduct({ name: "Hoodie", slug: "", description: null, price: 100, stock: 1, category: null, isActive: true });
  const productB = await insertProduct({ name: "Hoodie", slug: "", description: null, price: 100, stock: 1, category: null, isActive: true });
  const productSlugs = await database.rows(`select slug from products where id in (?, ?) order by slug`, [productA, productB]);
  assert.deepEqual(productSlugs.map((row) => row.slug), ["hoodie", "hoodie-2"]);
});

test("insertPost validates featured and stamps the first publication date", async () => {
  await assert.rejects(
    () =>
      insertPost({
        title: "Черновик",
        slug: "",
        excerpt: "",
        content: "текст",
        readTime: 3,
        sourceUrl: null,
        isPublished: false,
        isFeatured: true,
      }),
    /избранное/i,
  );

  const id = await insertPost({
    title: "Новый материал",
    slug: "",
    excerpt: "",
    content: "текст",
    readTime: 3,
    sourceUrl: null,
    isPublished: true,
    isFeatured: false,
  });
  const [row] = await database.rows(`select slug, published_at, is_published from posts where id = ?`, [id]);
  assert.equal(row.slug, "novyy-material");
  assert.equal(Number(row.is_published), 1);
  assert.ok(row.published_at, "publishing stamps published_at");
});

test("create actions stay silent without an admin session", async () => {
  admin = null;
  await serviceActions.createService(form({ title: "Скрытая услуга", basePrice: 10 }));
  await postActions.createPost(form({ title: "Скрытый материал", content: "x" }));
  await productActions.createProduct(form({ name: "Скрытый товар", price: 10, stock: 1 }));

  for (const table of ["services", "posts", "products"]) {
    const [row] = await database.rows(`select count(*) as total from ${table}`);
    assert.equal(Number(row.total), 0, `${table} must stay untouched`);
  }
  assert.deepEqual(redirects, []);
});

test("create actions log the new record and redirect to its card", async () => {
  await assert.rejects(
    () => serviceActions.createService(form({ title: "Новая услуга", basePrice: 500, priceType: "from", category: "small", isActive: "on" })),
    /saved=1$/,
  );
  await assert.rejects(
    () => productActions.createProduct(form({ name: "Новый товар", price: 990, stock: 4, isActive: "on" })),
    /saved=1$/,
  );
  await assert.rejects(
    () => postActions.createPost(form({ title: "Новый материал", excerpt: "о", content: "текст", readTime: 4 })),
    /saved=1$/,
  );

  const logs = await database.rows(`select action, actor_id_id from activity_logs order by action`);
  assert.deepEqual(
    logs.map((row) => row.action),
    ["post.created", "product.created", "service.created"],
  );
  assert.ok(logs.every((row) => row.actor_id_id === "usr-admin"), "every change is attributed to the admin");
  assert.ok(invalidated.includes("/shop"));
  assert.ok(invalidated.includes("/services"));
});

test("create actions send validation errors back to the empty form", async () => {
  await assert.rejects(
    () => serviceActions.createService(form({ title: "x", basePrice: 500, priceType: "from", category: "small" })),
    /\/admin\/services\/new\?error=/,
  );
  await assert.rejects(
    () => productActions.createProduct(form({ name: "Товар", price: 10, stock: 2.5 })),
    /\/admin\/products\/new\?error=/,
  );
  const [services] = await database.rows(`select count(*) as total from services`);
  assert.equal(Number(services.total), 0);
});
