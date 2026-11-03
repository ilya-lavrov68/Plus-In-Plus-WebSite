const assert = require("node:assert/strict");
const { after, before, afterEach, test } = require("node:test");
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

let database;
const mediaDir = path.resolve(__dirname, "..", "public", "uploads", "media");

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { applyCoverChange, coverFileFrom, isCoverSurface, setCover } = require("../lib/cover-images.ts");
const { UploadValidationError } = require("../lib/uploads.ts");

const now = () => new Date().toISOString();

async function pngFile(name = "cover.png") {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 18, g: 19, b: 27 } },
  })
    .png()
    .toBuffer();
  return new File([buffer], name, { type: "image/png" });
}

async function insertService() {
  await database.exec(
    `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price,
       price_type, is_published, is_active, sort_order, created_at, updated_at)
     values ('svc-1', 'Баннер', 'banner', 'large', '', '', '', 0, 'from', 1, 1, 0, ?, ?)`,
    [now(), now()],
  );
}

let created = new Set();

before(async () => {
  database = createTestDatabase("pip-covers-");
  await database.ready;
});

afterEach(async () => {
  // Тесты пишут настоящие файлы в public/uploads/media: убираем за собой,
  // чтобы прогон не оставлял мусор в рабочем дереве.
  for (const filename of created) {
    fs.rmSync(path.join(mediaDir, filename), { force: true });
  }
  created = new Set();
  await database.exec(`delete from media`);
  await database.exec(`delete from services`);
});

after(async () => {
  await database.close();
});

test("isCoverSurface only accepts the known tables", () => {
  assert.equal(isCoverSurface("services"), true);
  assert.equal(isCoverSurface("posts"), true);
  assert.equal(isCoverSurface("products"), true);
  assert.equal(isCoverSurface("orders"), false);
  assert.equal(isCoverSurface("site_settings"), false);
});

test("a valid upload becomes a media row and the record's cover", async () => {
  await insertService();
  const url = await applyCoverChange("services", "svc-1", {
    file: await pngFile(),
    remove: false,
    current: null,
  });

  assert.match(url, /^\/uploads\/media\/[0-9a-f-]{36}\.webp$/);
  const filename = url.replace("/uploads/media/", "");
  created.add(filename);
  assert.equal(fs.existsSync(path.join(mediaDir, filename)), true, "the file is written to disk");

  const [media] = await database.rows(`select url, kind, mime_type from media`);
  assert.equal(media.url, url);
  assert.equal(media.kind, "services");
  assert.equal(media.mime_type, "image/webp", "uploads are re-encoded, never stored as-is");

  const [service] = await database.rows(`select cover_image from services where id = 'svc-1'`);
  assert.equal(service.cover_image, url);
});

test("removing the cover clears the column and deletes the file", async () => {
  await insertService();
  const url = await applyCoverChange("services", "svc-1", { file: await pngFile(), remove: false, current: null });
  const filename = url.replace("/uploads/media/", "");
  created.add(filename);

  const result = await applyCoverChange("services", "svc-1", { file: null, remove: true, current: url });
  assert.equal(result, null);
  const [service] = await database.rows(`select cover_image from services where id = 'svc-1'`);
  assert.equal(service.cover_image, null);
  assert.equal(fs.existsSync(path.join(mediaDir, filename)), false);
  const [media] = await database.rows(`select count(*) as total from media`);
  assert.equal(Number(media.total), 0);
});

test("an untouched form keeps the current cover", async () => {
  await insertService();
  const result = await applyCoverChange("services", "svc-1", { file: null, remove: false, current: null });
  assert.equal(result, undefined, "undefined means 'leave as is'");
});

test("a non-image upload is rejected and the cover stays untouched", async () => {
  await insertService();
  await setCover("services", "svc-1", "/uploads/media/known.webp");
  const fake = new File([Buffer.from("not an image")], "fake.png", { type: "image/png" });

  await assert.rejects(
    () => applyCoverChange("services", "svc-1", { file: fake, remove: false, current: "/uploads/media/known.webp" }),
    UploadValidationError,
  );
  const [service] = await database.rows(`select cover_image from services where id = 'svc-1'`);
  assert.equal(service.cover_image, "/uploads/media/known.webp");
  const [media] = await database.rows(`select count(*) as total from media`);
  assert.equal(Number(media.total), 0, "nothing is stored for a rejected file");
});

test("coverFileFrom ignores the empty file input", () => {
  const form = new FormData();
  form.set("cover", new File([], "none.png", { type: "image/png" }));
  assert.equal(coverFileFrom(form), null);
});
