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
let admin, store, logs, failAudit, uploads, cleaned, invalidated, queries, sequence;
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
    delete: async ({ where }) => { queries += 1; const old = store[entity].get(where.id); if (!old) throw new Error("missing"); store[entity].delete(where.id); return structuredClone(old); },
  };
}
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
  uploads = []; cleaned = []; invalidated = []; queries = 0; sequence = 0;
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
