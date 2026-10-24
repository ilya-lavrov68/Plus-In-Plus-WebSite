const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

// In-memory repositories only. No user, content or seed is inserted in PostgreSQL.
let admin, store, logs, failAudit, uploads, cleaned, invalidated, queries, sequence, activeOrderCount;
class UploadValidationError extends Error {}
const prisma = { activityLog: { create: async ({ data }) => {
  if (failAudit) throw new Error("simulated audit failure"); logs.push(structuredClone(data)); return data;
} } };
for (const entity of ["service", "post"]) {
  prisma[entity] = {
    findUnique: async ({ where }) => { queries += 1; return structuredClone(store[entity].get(where.id) ?? null); },
    create: async ({ data }) => {
      queries += 1;
      if (entity === "post" && [...store.post.values()].some((p) => p.slug === data.slug)) throw Object.assign(new Error("unique"), { code: "P2002" });
      const result = { id: `mock-${entity}-${++sequence}`, ...structuredClone(data) }; store[entity].set(result.id, result); return structuredClone(result);
    },
    update: async ({ where, data }) => {
      queries += 1;
      const old = store[entity].get(where.id); if (!old) throw new Error("missing");
      if (entity === "post" && [...store.post.values()].some((p) => p.id !== where.id && p.slug === data.slug)) throw Object.assign(new Error("unique"), { code: "P2002" });
      Object.assign(old, structuredClone(data)); return structuredClone(old);
    },
    updateMany: async ({ where = {}, data }) => {
      queries += 1;
      let count = 0;
      for (const row of store[entity].values()) {
        if (where.id?.not && row.id === where.id.not) continue;
        if (where.id && typeof where.id === "string" && row.id !== where.id) continue;
        if (where.isPublished !== undefined && row.isPublished !== where.isPublished) continue;
        Object.assign(row, structuredClone(data));
        count += 1;
      }
      return { count };
    },
    delete: async ({ where }) => { queries += 1; const old = store[entity].get(where.id); if (!old) throw new Error("missing"); store[entity].delete(where.id); return structuredClone(old); },
    count: async ({ where = {} } = {}) => [...store[entity].values()].filter((row) => {
      if (where.coverImage !== undefined && row.coverImage !== where.coverImage) return false;
      if (where.OR) return where.OR.some((condition) => {
        if (condition.coverImage !== undefined && row.coverImage === condition.coverImage) return true;
        if (condition.images?.contains && typeof row.images === "string" && row.images.includes(condition.images.contains)) return true;
        return false;
      });
      return true;
    }).length,
  };
}
prisma.order = { count: async () => activeOrderCount };
prisma.$transaction = async (callback) => {
  const snapshot = structuredClone({ store, logs });
  try { return await callback(prisma); } catch (e) { store = snapshot.store; logs = snapshot.logs; throw e; }
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/admin-session") return { requireAdmin: async () => admin };
  if (name === "next/cache") return { revalidatePath: (url) => invalidated.push(url) };
  if (name === "@/lib/uploads") return {
    UploadValidationError,
    saveImageUpload: async (file, kind) => { const url = `/uploads/${kind}/00000000-0000-4000-a000-${String(++sequence).padStart(12, "0")}.webp`; uploads.push({ file, kind, url }); return url; },
    cleanupUpload: async (url, kind) => { if (url) cleaned.push({ url, kind }); },
  };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};
const services = require("../app/actions/services.ts");
const posts = require("../app/actions/posts.ts");

beforeEach(() => {
  admin = { id: "unit-test-admin", role: "ADMIN" };
  store = { service: new Map(), post: new Map() }; logs = []; failAudit = false;
  uploads = []; cleaned = []; invalidated = []; queries = 0; sequence = 0; activeOrderCount = 0;
});

function serviceForm(cover = true) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: "Title", category: "small", shortDesc: "Short", fullDesc: "Full", includes: "One\n Two", shapes: "Square", resultText: "Result", isPublished: "true" })) form.set(key, value);
  if (cover) form.set("cover", new File(["mock"], "cover.png", { type: "image/png" }));
  return form;
}
function postForm(cover = true) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: "Post", slug: "post-slug", excerpt: "Excerpt", content: '<p onclick="alert(1)">Article</p><script>bad()</script>', readTime: "5", isPublished: "true" })) form.set(key, value);
  if (cover) form.set("cover", new File(["mock"], "cover.png", { type: "image/png" }));
  return form;
}
async function quiet(callback) { const old = console.error; console.error = () => {}; try { return await callback(); } finally { console.error = old; } }

test("every CRUD action rejects non-admins before reading the DB or writing a file", async () => {
  admin = null;
  for (const result of [await services.createService(serviceForm()), await services.updateService("id", serviceForm()), await services.deleteService("id"), await posts.createPost(postForm()), await posts.updatePost("id", postForm()), await posts.deletePost("id")]) assert.equal(result.ok, false);
  assert.equal(queries, 0); assert.equal(uploads.length, 0); assert.equal(logs.length, 0);
});

test("service create/update/delete commits data and audit entries, replaces and removes covers", async () => {
  const created = await services.createService(serviceForm());
  assert.equal(created.ok, true);
  const firstCover = store.service.get(created.id).coverImage;
  // SQLite has no JSON column: lists are stored as JSON strings (lib/db-helpers.ts).
  assert.deepEqual(JSON.parse(store.service.get(created.id).includes), ["One", "Two"]);
  assert.deepEqual(JSON.parse(store.service.get(created.id).shapes), ["Square"]);
  assert.match(store.service.get(created.id).slug, /^[a-z0-9-]+$/);
  assert.equal(uploads[0].kind, "services");
  const edit = serviceForm(); edit.set("title", "Updated title"); edit.set("isPublished", "false"); edit.set("category", "large");
  assert.equal((await services.updateService(created.id, edit)).ok, true);
  const updated = store.service.get(created.id);
  assert.equal(updated.title, "Updated title"); assert.equal(updated.category, "large"); assert.equal(updated.isPublished, false);
  assert.notEqual(updated.coverImage, firstCover);
  assert.deepEqual(cleaned[0], { url: firstCover, kind: "services" });
  assert.equal((await services.deleteService(created.id)).ok, true);
  assert.equal(store.service.size, 0);
  assert.deepEqual(logs.map((e) => e.action), ["created", "updated", "deleted"]);
  assert.equal(logs.at(-1).title, "Updated title");
  assert.ok(logs.every((e) => e.actorId === admin.id));
  assert.ok(cleaned.some((c) => c.url === updated.coverImage));
  for (const url of ["/shop", `/shop/${created.id}`, "/admin/services", "/admin/dashboard"]) assert.ok(invalidated.includes(url), url);
});

test("service updates without a new file keep the current cover", async () => {
  const { id } = await services.createService(serviceForm());
  const cover = store.service.get(id).coverImage;
  assert.equal((await services.updateService(id, serviceForm(false))).ok, true);
  assert.equal(store.service.get(id).coverImage, cover);
  assert.equal(uploads.length, 1); assert.equal(cleaned.length, 0);
});

test("blog CRUD sanitizes HTML, preserves publication date and revalidates old/new slugs", async () => {
  const created = await posts.createPost(postForm());
  assert.equal(created.ok, true);
  let record = store.post.get(created.id);
  assert.equal(record.content, "<p>Article</p>");
  assert.equal(record.source, "manual"); assert.equal(uploads[0].kind, "blog");
  const published = record.publishedAt.toISOString();
  const edit = postForm(false); edit.set("slug", "renamed-post");
  assert.equal((await posts.updatePost(created.id, edit)).ok, true);
  record = store.post.get(created.id);
  assert.equal(record.publishedAt.toISOString(), published);
  assert.ok(invalidated.includes("/blog/post-slug")); assert.ok(invalidated.includes("/blog/renamed-post"));
  edit.set("isPublished", "false");
  assert.equal((await posts.updatePost(created.id, edit)).ok, true);
  assert.equal(store.post.get(created.id).publishedAt, null);
  assert.equal((await posts.deletePost(created.id)).ok, true);
  assert.equal(store.post.size, 0);
  assert.deepEqual(logs.map((e) => e.action), ["created", "updated", "updated", "deleted"]);
  assert.ok(cleaned.some((c) => c.url === record.coverImage && c.kind === "blog"));
});

test("create, edit and bulk publish preserve exactly one Featured post", async () => {
  const firstForm = postForm();
  firstForm.set("slug", "first-featured");
  firstForm.set("isFeatured", "true");
  const first = await posts.createPost(firstForm);
  assert.equal(first.ok, true);

  const secondForm = postForm();
  secondForm.set("slug", "second-featured");
  secondForm.set("isFeatured", "true");
  const second = await posts.createPost(secondForm);
  assert.equal(second.ok, true);
  assert.equal(store.post.get(first.id).isFeatured, false);
  assert.equal(store.post.get(second.id).isFeatured, true);

  const editFirst = postForm(false);
  editFirst.set("slug", "first-featured");
  editFirst.set("isFeatured", "true");
  assert.equal((await posts.updatePost(first.id, editFirst)).ok, true);
  assert.equal(store.post.get(first.id).isFeatured, true);
  assert.equal(store.post.get(second.id).isFeatured, false);

  // Repair a legacy duplicate as well: publishing the selected Featured row
  // must clear every competing flag inside the same transaction.
  store.post.get(second.id).isFeatured = true;
  assert.equal((await posts.bulkUpdatePosts([second.id], "publish")).ok, true);
  assert.equal(store.post.get(first.id).isFeatured, false);
  assert.equal(store.post.get(second.id).isFeatured, true);
  assert.equal([...store.post.values()].filter((post) => post.isFeatured).length, 1);
});

test("bulk actions reject unknown operations before any database write", async () => {
  const { id } = await posts.createPost(postForm());
  const before = structuredClone(store.post.get(id));
  const queryCount = queries;
  assert.equal((await posts.bulkUpdatePosts([id], "feature")).ok, false);
  assert.equal((await services.bulkUpdateServices(["missing"], "feature")).ok, false);
  assert.equal(queries, queryCount);
  assert.deepEqual(store.post.get(id), before);
});

test("duplicate post slugs clean up the new cover and never leave an audit entry", async () => {
  assert.equal((await posts.createPost(postForm())).ok, true);
  const result = await posts.createPost(postForm());
  assert.equal(result.ok, false); assert.match(result.error, /slug already exists/);
  assert.equal(store.post.size, 1); assert.equal(logs.length, 1);
  assert.deepEqual(cleaned, [{ url: uploads[1].url, kind: "blog" }]);
});

test("create and update roll back with the audit log and clean only uncommitted uploads", async () => {
  failAudit = true;
  assert.equal((await quiet(() => services.createService(serviceForm()))).ok, false);
  assert.equal(store.service.size, 0); assert.equal(logs.length, 0);
  assert.deepEqual(cleaned[0], { url: uploads[0].url, kind: "services" });
  failAudit = false;
  const { id } = await posts.createPost(postForm());
  const previous = structuredClone(store.post.get(id));
  failAudit = true;
  const changed = postForm(); changed.set("slug", "changed");
  assert.equal((await quiet(() => posts.updatePost(id, changed))).ok, false);
  assert.deepEqual(store.post.get(id), previous);
  assert.equal(logs.length, 1);
  assert.ok(cleaned.some((c) => c.url === uploads.at(-1).url));
  assert.ok(!cleaned.some((c) => c.url === previous.coverImage));
});

test("a failed delete/audit transaction preserves the record and its image", async () => {
  const { id } = await services.createService(serviceForm());
  failAudit = true;
  assert.equal((await quiet(() => services.deleteService(id))).ok, false);
  assert.equal(store.service.has(id), true); assert.equal(cleaned.length, 0); assert.equal(logs.length, 1);
});

test("invalid categories, slugs, read times, remote covers and missing uploads do not write data", async () => {
  const badCategory = serviceForm(); badCategory.set("category", "other");
  const badSlug = postForm(); badSlug.set("slug", "../escape");
  const badTime = postForm(); badTime.set("readTime", "1.5");
  const remote = serviceForm(false); remote.set("cover", "https://remote.test/image.png");
  for (const result of [await services.createService(badCategory), await services.createService(remote), await services.createService(serviceForm(false)), await posts.createPost(badSlug), await posts.createPost(badTime), await posts.createPost(postForm(false))]) assert.equal(result.ok, false);
  assert.equal(queries, 0); assert.equal(uploads.length, 0); assert.equal(logs.length, 0);
});

// ── Быстрая правка цены ────────────────────────────────────────────────────
// Цена меняется чаще остальных полей, поэтому правится прямо из таблицы.

test("цена услуги правится и пишется в журнал", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Визитки", slug: "visitki", basePrice: 89000, priceType: "fixed", isOrderable: true });
  const result = await services.updateServicePrice({ serviceId: "svc-1", basePriceRub: "1200" });

  assert.equal(result.ok, true);
  assert.equal(store.service.get("svc-1").basePrice, 120_000, "рубли переведены в копейки");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "updated");
});

test("запятая в цене допустима", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Визитки", slug: "visitki", basePrice: 0, priceType: "fixed" });
  const result = await services.updateServicePrice({ serviceId: "svc-1", basePriceRub: "899,50" });
  assert.equal(result.ok, true);
  assert.equal(store.service.get("svc-1").basePrice, 89_950);
});

test("пустая цена не делает услугу бесплатной", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Визитки", slug: "visitki", basePrice: 89000, priceType: "fixed" });
  // Number("") === 0 — без проверки услуга стала бы бесплатной.
  for (const basePriceRub of ["", "   ", "abc", "-50", "999999999"]) {
    const result = await services.updateServicePrice({ serviceId: "svc-1", basePriceRub });
    assert.equal(result.ok, false, `«${basePriceRub}» не должно проходить`);
  }
  assert.equal(store.service.get("svc-1").basePrice, 89000);
  assert.equal(logs.length, 0);
});

test("цена без изменений не пишется в базу", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Визитки", slug: "visitki", basePrice: 89000, priceType: "fixed" });
  const result = await services.updateServicePrice({ serviceId: "svc-1", basePriceRub: "890" });
  assert.equal(result.ok, true);
  assert.equal(logs.length, 0, "журнал не должен пополняться пустой правкой");
});

test("тип цены меняется, «по запросу» снимает возможность заказа", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Вывеска", slug: "vyveska", basePrice: 0, priceType: "from", isOrderable: true });
  const result = await services.updateServicePriceType({ serviceId: "svc-1", priceType: "quote" });

  assert.equal(result.ok, true);
  assert.equal(store.service.get("svc-1").priceType, "quote");
  // Цены нет, значит заказать самому нельзя — только обсудить с менеджером.
  assert.equal(store.service.get("svc-1").isOrderable, false);
});

test("точную цену можно заказать, если услуга это разрешает", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Вывеска", slug: "vyveska", basePrice: 0, priceType: "quote", isOrderable: false });
  const result = await services.updateServicePriceType({ serviceId: "svc-1", priceType: "fixed", isOrderable: true });

  assert.equal(result.ok, true);
  assert.equal(store.service.get("svc-1").priceType, "fixed");
  assert.equal(store.service.get("svc-1").isOrderable, true);
});

test("неизвестный тип цены отвергается", async () => {
  store.service.set("svc-1", { id: "svc-1", title: "Вывеска", slug: "vyveska", basePrice: 0, priceType: "fixed" });
  const result = await services.updateServicePriceType({ serviceId: "svc-1", priceType: "whatever" });
  assert.equal(result.ok, false);
  assert.equal(store.service.get("svc-1").priceType, "fixed");
});

test("менеджер не может менять цену услуги", async () => {
  // Управление сайтом — только администратор.
  admin = null;
  store.service.set("svc-1", { id: "svc-1", title: "Визитки", slug: "visitki", basePrice: 89000, priceType: "fixed" });
  assert.equal((await services.updateServicePrice({ serviceId: "svc-1", basePriceRub: "1" })).ok, false);
  assert.equal((await services.updateServicePriceType({ serviceId: "svc-1", priceType: "quote" })).ok, false);
  assert.equal(store.service.get("svc-1").basePrice, 89000);
  assert.equal(store.service.get("svc-1").priceType, "fixed");
});

test("full service creation persists pricing and normalized option groups", async () => {
  const form = serviceForm();
  form.set("basePriceRub", "1250,50");
  form.set("priceType", "fixed");
  form.set("isOrderable", "true");
  form.set("optionGroups", JSON.stringify([{
    name: "Finish",
    required: true,
    options: [{ label: "Gloss", priceDeltaRub: "12.50", priceFactor: "1.25", isDefault: true }],
  }]));
  const result = await services.createService(form);
  assert.equal(result.ok, true);
  const created = store.service.get(result.id);
  assert.equal(created.basePrice, 125050);
  assert.equal(created.priceType, "fixed");
  assert.equal(created.isOrderable, true);
  assert.equal(created.optionGroups.create[0].name, "Finish");
  assert.equal(created.optionGroups.create[0].options.create[0].priceDelta, 1250);
  assert.equal(created.optionGroups.create[0].options.create[0].priceFactor, 1.25);
});

test("invalid option configurations are rejected before an upload or database write", async () => {
  const form = serviceForm();
  form.set("basePriceRub", "100");
  form.set("priceType", "fixed");
  form.set("optionGroups", JSON.stringify([{
    name: "Finish",
    required: true,
    options: [
      { label: "One", priceDeltaRub: "0", priceFactor: "1", isDefault: true },
      { label: "Two", priceDeltaRub: "0", priceFactor: "1", isDefault: true },
    ],
  }]));
  assert.equal((await services.createService(form)).ok, false);
  assert.equal(store.service.size, 0);
  assert.equal(uploads.length, 0);
  assert.equal(queries, 0);
});

test("full edits cannot change pricing or options while the service has active orders", async () => {
  store.service.set("svc-locked", {
    id: "svc-locked", title: "Title", slug: "title", basePrice: 1000,
    priceType: "fixed", isOrderable: true, optionGroups: [], coverImage: null,
  });
  activeOrderCount = 1;
  const form = serviceForm(false);
  form.set("basePriceRub", "20");
  form.set("priceType", "fixed");
  form.set("isOrderable", "true");
  form.set("optionGroups", "[]");
  assert.equal((await services.updateService("svc-locked", form)).ok, false);
  assert.equal(store.service.get("svc-locked").basePrice, 1000);
  assert.equal(uploads.length, 0);
});

test("duplicating a service copies pricing/options as an inactive draft without reusable option IDs", async () => {
  store.service.set("svc-source", {
    id: "svc-source", title: "Source", slug: "source", category: "small",
    shortDesc: "Short", fullDesc: "Full", includes: "[]", shapes: "[]",
    resultText: "Result", coverImage: "/uploads/services/shared.webp", basePrice: 2000,
    priceType: "from", currency: "RUB", isOrderable: true, isActive: true,
    isPublished: true, sortOrder: 4,
    optionGroups: [{
      id: "group-source", serviceId: "svc-source", name: "Finish", required: true, sortOrder: 0,
      options: [{ id: "option-source", groupId: "group-source", label: "Gloss", priceDelta: 500, priceFactor: 1, isDefault: true, sortOrder: 0 }],
    }],
  });
  const result = await services.duplicateService("svc-source");
  assert.equal(result.ok, true);
  const copy = store.service.get(result.id);
  assert.equal(copy.isActive, false);
  assert.equal(copy.isPublished, false);
  assert.equal(copy.basePrice, 2000);
  assert.equal(copy.optionGroups.create[0].id, undefined);
  assert.equal(copy.optionGroups.create[0].serviceId, undefined);
  assert.equal(copy.optionGroups.create[0].options.create[0].id, undefined);
  assert.equal(copy.optionGroups.create[0].options.create[0].priceDelta, 500);
});

test("deleting duplicated services never unlinks a cover still used by the other row", async () => {
  const cover = "/uploads/services/shared-cover.webp";
  for (const id of ["service-a", "service-b"]) {
    store.service.set(id, { id, title: id, slug: id, coverImage: cover });
  }
  assert.equal((await services.deleteService("service-a")).ok, true);
  assert.equal(cleaned.some((entry) => entry.url === cover), false);
  assert.equal((await services.deleteService("service-b")).ok, true);
  assert.equal(cleaned.filter((entry) => entry.url === cover).length, 1);
});

test("post cleanup respects both duplicated covers and album references", async () => {
  const cover = "/uploads/blog/shared-cover.webp";
  store.post.set("post-a", { id: "post-a", title: "A", slug: "a", coverImage: cover, images: null });
  store.post.set("post-b", { id: "post-b", title: "B", slug: "b", coverImage: cover, images: null });
  assert.equal((await posts.deletePost("post-a")).ok, true);
  assert.equal(cleaned.some((entry) => entry.url === cover), false);
  assert.equal((await posts.deletePost("post-b")).ok, true);
  assert.equal(cleaned.filter((entry) => entry.url === cover).length, 1);

  cleaned = [];
  store.post.set("post-c", { id: "post-c", title: "C", slug: "c", coverImage: cover, images: null });
  store.post.set("post-d", { id: "post-d", title: "D", slug: "d", coverImage: "/uploads/blog/other.webp", images: JSON.stringify([cover]) });
  assert.equal((await posts.deletePost("post-c")).ok, true);
  assert.equal(cleaned.some((entry) => entry.url === cover), false, "album still references the image");
});
