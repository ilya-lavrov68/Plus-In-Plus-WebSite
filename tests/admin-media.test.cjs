const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const sharp = require("sharp");
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
let mediaDir;
let created = new Set();

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return { requireAdmin: async () => admin, requireStaff: async () => admin };
  }
  if (name === "next/cache") return { revalidatePath: () => {} };
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

const { deleteMedia, listMedia, usageCountFor } = require("../lib/media-library.ts");
const { saveAlbumImage } = require("../lib/uploads.ts");
const { deleteMediaAction } = require("../app/(admin)/admin/media/actions.ts");

const now = () => new Date().toISOString();

async function pngFile() {
  const buffer = await sharp({ create: { width: 5, height: 5, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png()
    .toBuffer();
  return new File([buffer], "shot.png", { type: "image/png" });
}

async function upload() {
  const url = await saveAlbumImage(await pngFile());
  created.add(url.replace("/uploads/media/", ""));
  const [media] = await database.rows(`select id from media where url = ?`, [url]);
  return { id: media.id, url };
}

before(async () => {
  database = createTestDatabase("pip-media-");
  await database.ready;
  mediaDir = path.resolve(__dirname, "..", "public", "uploads", "media");
});

beforeEach(async () => {
  await database.exec(`delete from posts_rels`);
  await database.exec(`delete from posts`);
  await database.exec(`delete from services`);
  await database.exec(`delete from products`);
  await database.exec(`delete from media`);
  await database.exec(`delete from activity_logs`);
  await database.exec(`delete from accounts`);
  await database.exec(
    `insert into accounts (id, email, role, is_blocked, created_at, updated_at) values ('usr-admin', 'a@example.com', 'ADMIN', 0, ?, ?)`,
    [now(), now()],
  );
  admin = { id: "usr-admin", role: "ADMIN", isFounder: false };
  redirects = [];
  for (const filename of created) fs.rmSync(path.join(mediaDir, filename), { force: true });
  created = new Set();
});

after(async () => {
  for (const filename of created) fs.rmSync(path.join(mediaDir, filename), { force: true });
  await database.close();
});

test("listMedia reports size, dimensions and usage", async () => {
  const file = await upload();
  const items = await listMedia();
  assert.equal(items.length, 1);
  assert.equal(items[0].id, file.id);
  assert.ok(items[0].filesize > 0);
  assert.equal(items[0].width, 5);
  assert.equal(items[0].usageCount, 0);
});

test("an unused file can be deleted together with its row and file", async () => {
  const file = await upload();
  await deleteMedia(file.id);
  assert.equal((await listMedia()).length, 0);
  assert.equal(fs.existsSync(path.join(mediaDir, file.url.replace("/uploads/media/", ""))), false);
});

test("a cover reference blocks deletion", async () => {
  const file = await upload();
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price, price_type,
       is_published, is_active, sort_order, cover_image, created_at, updated_at)
     values ('svc-1', 'Услуга', 'svc', 'small', '', '', '', 0, 'from', 1, 1, 0, ?, ?, ?)`,
    [file.url, now(), now()],
  );
  assert.equal(await usageCountFor(file.id), 1);
  await assert.rejects(() => deleteMedia(file.id), /используется/i);
  assert.equal((await listMedia()).length, 1, "the file stays");
});

test("a gallery reference blocks deletion too", async () => {
  const file = await upload();
  await database.exec(
    `insert into posts (id, title, slug, excerpt, content, read_time, source, is_published, created_at, updated_at)
     values ('post-1', 'Пост', 'post', '', 'x', 5, 'manual', 1, ?, ?)`,
    [now(), now()],
  );
  await database.exec(`insert into posts_rels ("order", parent_id, path, media_id) values (1, 'post-1', 'images', ?)`, [file.id]);
  await assert.rejects(() => deleteMedia(file.id), /используется/i);
});

test("deleteMediaAction refuses without an admin and logs a successful delete", async () => {
  const file = await upload();
  admin = null;
  const form = new FormData();
  form.set("id", file.id);
  await deleteMediaAction(form);
  assert.equal((await listMedia()).length, 1);
  assert.deepEqual(redirects, []);

  admin = { id: "usr-admin", role: "ADMIN", isFounder: false };
  await assert.rejects(() => deleteMediaAction(form), /redirect:\/admin\/media\?deleted=1/);
  assert.equal((await listMedia()).length, 0);
  const [log] = await database.rows(`select action, entity_type, actor_id_id from activity_logs`);
  assert.equal(log.action, "media.deleted");
  assert.equal(log.entity_type, "media");
  assert.equal(log.actor_id_id, "usr-admin");
});

test("deleteMediaAction surfaces the in-use error instead of deleting", async () => {
  const file = await upload();
  await database.exec(
    `insert into products (id, name, slug, price, stock, is_active, cover_image, created_at, updated_at)
     values ('prd-1', 'Товар', 'prd', 100, 1, 1, ?, ?, ?)`,
    [file.url, now(), now()],
  );
  const form = new FormData();
  form.set("id", file.id);
  await assert.rejects(() => deleteMediaAction(form), /\/admin\/media\?error=/);
  assert.equal((await listMedia()).length, 1);
});
