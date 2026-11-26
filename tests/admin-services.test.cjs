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

// Услуги, правила каталога и админское действие проверяются на настоящей
// SQLite: важен реальный SQL, блокировка цены и границы доступа.
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

const { saveService } = require("../app/(admin)/admin/services/actions.ts");
const { countActiveServiceOrders, deleteService, updateService } = require("../lib/service-rules.ts");

const now = () => new Date().toISOString();

async function insertService(overrides = {}) {
  const service = {
    id: "svc-sign",
    title: "Sign Design",
    slug: "sign-design",
    category: "small",
    shortDesc: "Short",
    fullDesc: "Full",
    basePrice: 5000,
    priceType: "from",
    isPublished: true,
    isActive: true,
    sortOrder: 1,
    ...overrides,
  };
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price, price_type,
       currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 'Ready', ?, ?, 'RUB', 1, ?, ?, ?, ?, ?)`,
    [
      service.id,
      service.title,
      service.slug,
      service.category,
      service.shortDesc,
      service.fullDesc,
      Math.round(service.basePrice * 100),
      service.priceType,
      service.isPublished ? 1 : 0,
      service.isActive ? 1 : 0,
      service.sortOrder,
      now(),
      now(),
    ],
  );
  return service;
}

async function insertOrderWithService(status) {
  await database.exec(
    `insert or ignore into accounts (id, email, role, is_blocked, created_at, updated_at)
     values ('usr-1', 'client@example.com', 'USER', 0, ?, ?)`,
    [now(), now()],
  );
  await database.exec(
    `insert into orders (id, order_number, number, user_id_id, status, estimated_amount, subtotal, discount, total,
       currency, created_at, updated_at)
     values ('ord-1', 'PIP-000001', 'PIP-000001', 'usr-1', ?, 0, 0, 0, 0, 'RUB', ?, ?)`,
    [status, now(), now()],
  );
  await database.exec(
    `insert into order_services (id, order_id_id, service_id_id, quantity, created_at, updated_at)
     values ('os-1', 'ord-1', 'svc-sign', 1, ?, ?)`,
    [now(), now()],
  );
}

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

before(async () => {
  database = createTestDatabase("pip-services-");
  await database.ready;
});

beforeEach(async () => {
  for (const table of ["order_services", "order_items", "orders", "services_includes", "services_shapes", "services_option_groups_options", "services_option_groups", "services", "activity_logs", "accounts"]) {
    await database.exec(`delete from ${table}`);
  }
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

test("updateService stores the edited fields and kopecks", async () => {
  await insertService();
  await updateService({
    id: "svc-sign",
    title: "Sign Design Pro",
    category: "large",
    shortDesc: "Short new",
    fullDesc: "Full new",
    basePrice: 7777,
    priceType: "from",
    isPublished: false,
    isActive: true,
    sortOrder: 5,
  });

  const [row] = await database.rows(
    `select title, category, short_desc, full_desc, base_price, is_published, is_active, sort_order, is_orderable
     from services where id = 'svc-sign'`,
  );
  assert.equal(row.title, "Sign Design Pro");
  assert.equal(row.category, "large");
  assert.equal(row.short_desc, "Short new");
  assert.equal(row.full_desc, "Full new");
  assert.equal(Number(row.base_price), 777700, "price is stored in kopecks");
  assert.equal(Number(row.is_published), 0);
  assert.equal(Number(row.is_active), 1);
  assert.equal(Number(row.sort_order), 5);
  assert.equal(Number(row.is_orderable), 1);
});

test("a quote-priced service is never orderable directly", async () => {
  await insertService({ priceType: "from" });
  await updateService({
    id: "svc-sign",
    title: "Sign Design",
    category: "small",
    shortDesc: "Short",
    fullDesc: "Full",
    basePrice: 5000,
    priceType: "quote",
    isPublished: true,
    isActive: true,
    sortOrder: 1,
  });
  const [row] = await database.rows(`select price_type, is_orderable from services where id = 'svc-sign'`);
  assert.equal(row.price_type, "quote");
  assert.equal(Number(row.is_orderable), 0);
});

test("pricing of a service with active orders is locked, deletion is refused", async () => {
  await insertService();
  await insertOrderWithService("in_progress");
  assert.equal(await countActiveServiceOrders("svc-sign"), 1);

  await assert.rejects(
    () =>
      updateService({
        id: "svc-sign",
        title: "Sign Design",
        category: "small",
        shortDesc: "Short",
        fullDesc: "Full",
        basePrice: 9000,
        priceType: "from",
        isPublished: true,
        isActive: true,
        sortOrder: 1,
      }),
    /активными заказами/,
  );
  await assert.rejects(() => deleteService("svc-sign"), /нельзя удалить/);

  // Неценовые поля менять можно.
  await updateService({
    id: "svc-sign",
    title: "Sign Design Updated",
    category: "small",
    shortDesc: "Short",
    fullDesc: "Full",
    basePrice: 5000,
    priceType: "from",
    isPublished: true,
    isActive: true,
    sortOrder: 1,
  });
  const [row] = await database.rows(`select title, base_price from services where id = 'svc-sign'`);
  assert.equal(row.title, "Sign Design Updated");
  assert.equal(Number(row.base_price), 500000);
});

test("a closed order no longer locks the price", async () => {
  await insertService();
  await insertOrderWithService("completed");
  assert.equal(await countActiveServiceOrders("svc-sign"), 0);
  await updateService({
    id: "svc-sign",
    title: "Sign Design",
    category: "small",
    shortDesc: "Short",
    fullDesc: "Full",
    basePrice: 6000,
    priceType: "from",
    isPublished: true,
    isActive: true,
    sortOrder: 1,
  });
  const [row] = await database.rows(`select base_price from services where id = 'svc-sign'`);
  assert.equal(Number(row.base_price), 600000);
});

test("saveService is silent for a non-admin staff session", async () => {
  await insertService();
  admin = null;
  await saveService(form({ id: "svc-sign", title: "Hacked", basePrice: 1 }));
  const [row] = await database.rows(`select title, base_price from services where id = 'svc-sign'`);
  assert.equal(row.title, "Sign Design");
  assert.equal(Number(row.base_price), 500000);
  assert.deepEqual(redirects, []);
});

test("saveService validates input and reports the reason", async () => {
  await insertService();
  await assert.rejects(
    () => saveService(form({ id: "svc-sign", title: "X", basePrice: 100 })),
    /redirect:\/admin\/services\/svc-sign\?error=/,
  );
  await assert.rejects(
    () => saveService(form({ id: "svc-sign", title: "Valid name", basePrice: -5 })),
    /redirect:\/admin\/services\/svc-sign\?error=/,
  );
  const [row] = await database.rows(`select title from services where id = 'svc-sign'`);
  assert.equal(row.title, "Sign Design");
});

test("saveService writes the service, logs the action and revalidates the site", async () => {
  await insertService();
  await assert.rejects(
    () =>
      saveService(
        form({
          id: "svc-sign",
          title: "Sign Design Deluxe",
          category: "large",
          shortDesc: "Short",
          fullDesc: "Full",
          basePrice: 12345,
          priceType: "from",
          sortOrder: 3,
          isPublished: "on",
          isActive: "on",
        }),
      ),
    /redirect:\/admin\/services\/svc-sign\?saved=1/,
  );

  const [row] = await database.rows(`select title, category, base_price from services where id = 'svc-sign'`);
  assert.equal(row.title, "Sign Design Deluxe");
  assert.equal(row.category, "large");
  assert.equal(Number(row.base_price), 1234500);

  const [log] = await database.rows(`select action, actor_id_id from activity_logs where entity_id = 'svc-sign'`);
  assert.equal(log.action, "service.updated");
  assert.equal(log.actor_id_id, "usr-admin");

  for (const url of ["/admin/services", "/services", "/"]) {
    assert.ok(invalidated.includes(url), `${url} must be revalidated`);
  }
});

test("saveService blocks a price change when active orders exist", async () => {
  await insertService();
  await insertOrderWithService("paid");
  await assert.rejects(
    () =>
      saveService(
        form({
          id: "svc-sign",
          title: "Sign Design",
          category: "small",
          shortDesc: "Short",
          fullDesc: "Full",
          basePrice: 9999,
          priceType: "from",
          sortOrder: 1,
          isPublished: "on",
          isActive: "on",
        }),
      ),
    /redirect:\/admin\/services\/svc-sign\?error=/,
  );
  const [row] = await database.rows(`select base_price from services where id = 'svc-sign'`);
  assert.equal(Number(row.base_price), 500000);
});
