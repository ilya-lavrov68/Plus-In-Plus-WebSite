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
const mediaDir = path.resolve(__dirname, "..", "public", "uploads", "media");
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
      notFound: () => {
        throw new Error("notFound");
      },
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { appendGalleryImages, clearGallery, listGallery, MAX_GALLERY_IMAGES, removeGalleryImage } = require("../lib/post-gallery.ts");
const { deletePost } = require("../lib/post-rules.ts");
const { savePostGallery } = require("../app/(admin)/admin/posts/actions.ts");

const now = () => new Date().toISOString();

async function pngFile(name = "shot.png") {
  const buffer = await sharp({ create: { width: 6, height: 6, channels: 3, background: { r: 255, g: 255, b: 1 } } })
    .png()
    .toBuffer();
  return new File([buffer], name, { type: "image/png" });
}

async function insertPost(id = "post-1", slug = "post") {
  await database.exec(
    `insert into posts (id, title, slug, excerpt, content, read_time, source, is_published, created_at, updated_at)
     values (?, 'Заголовок', ?, '', 'текст', 5, 'manual', 1, ?, ?)`,
    [id, slug, now(), now()],
  );
}

function form(fields, files = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  for (const [key, list] of Object.entries(files)) for (const file of list) data.append(key, file);
  return data;
}

before(async () => {
  database = createTestDatabase("pip-gallery-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from posts_rels`);
  await database.exec(`delete from posts`);
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

function track(images) {
  for (const image of images) created.add(image.url.replace("/uploads/media/", ""));
}

test("uploaded files become ordered posts_rels rows", async () => {
  await insertPost();
  const urls = await appendGalleryImages("post-1", [await pngFile("a.png"), await pngFile("b.png")]);
  assert.equal(urls.length, 2);
  for (const url of urls) created.add(url.replace("/uploads/media/", ""));

  const images = await listGallery("post-1");
  assert.deepEqual(images.map((image) => image.url), urls, "row order follows the upload order");
  assert.deepEqual(images.map((image) => image.position), [1, 2]);

  const [rel] = await database.rows(`select path from posts_rels limit 1`);
  assert.equal(rel.path, "images", "the gallery is stored under the images path");
});

test("removing an image deletes the row and its file", async () => {
  await insertPost();
  const urls = await appendGalleryImages("post-1", [await pngFile()]);
  const images = await listGallery("post-1");
  track(images);

  await removeGalleryImage("post-1", images[0].mediaId);
  assert.deepEqual(await listGallery("post-1"), []);
  assert.equal(fs.existsSync(path.join(mediaDir, urls[0].replace("/uploads/media/", ""))), false);
});

test("the gallery is capped and nothing is stored past the limit", async () => {
  await insertPost();
  const images = [];
  for (let index = 0; index < MAX_GALLERY_IMAGES; index += 1) images.push(await pngFile(`${index}.png`));
  const urls = await appendGalleryImages("post-1", images);
  for (const url of urls) created.add(url.replace("/uploads/media/", ""));

  await assert.rejects(() => appendGalleryImages("post-1", [images[0]]), /не может быть больше/);
  assert.equal((await listGallery("post-1")).length, MAX_GALLERY_IMAGES);
});

test("a broken file in the batch leaves no orphans", async () => {
  await insertPost();
  const good = await pngFile("good.png");
  const bad = new File([Buffer.from("not an image")], "bad.png", { type: "image/png" });
  await assert.rejects(() => appendGalleryImages("post-1", [good, bad]));
  assert.deepEqual(await listGallery("post-1"), [], "no rows are written for a failed batch");
  const [rels] = await database.rows(`select count(*) as total from posts_rels`);
  assert.equal(Number(rels.total), 0);
});

test("deleting a post clears its gallery rows and files", async () => {
  await insertPost();
  const images = await appendGalleryImages("post-1", [await pngFile()]);
  const listed = await listGallery("post-1");
  track(listed);

  await deletePost("post-1");
  assert.deepEqual(await listGallery("post-1"), []);
  assert.equal(fs.existsSync(path.join(mediaDir, images[0].replace("/uploads/media/", ""))), false);
  const [media] = await database.rows(`select count(*) as total from media`);
  assert.equal(Number(media.total), 0);
});

test("savePostGallery stores additions and removals in one submit", async () => {
  await insertPost();
  const first = await appendGalleryImages("post-1", [await pngFile("keep.png"), await pngFile("drop.png")]);
  let images = await listGallery("post-1");
  const removing = images.find((image) => image.url === first[1]);
  track(images);

  admin = { id: "usr-admin", role: "ADMIN", isFounder: false };
  const added = await pngFile("new.png");
  await assert.rejects(
    () => savePostGallery(form({ id: "post-1", removeGallery: removing.mediaId }, { gallery: [added] })),
    /redirect:\/admin\/posts\/post-1\?saved=1/,
  );

  images = await listGallery("post-1");
  assert.equal(images.length, 2, "one removed, one added");
  track(images);
  const [log] = await database.rows(`select action from activity_logs`);
  assert.equal(log.action, "post.gallery_updated");
});

test("savePostGallery is silent without an admin session", async () => {
  await insertPost();
  admin = null;
  const file = await pngFile();
  await savePostGallery(form({ id: "post-1" }, { gallery: [file] }));
  assert.deepEqual(await listGallery("post-1"), []);
  assert.deepEqual(redirects, []);
});

test("clearGallery empties the gallery without touching the post", async () => {
  await insertPost();
  const images = await appendGalleryImages("post-1", [await pngFile()]);
  track(await listGallery("post-1"));
  await clearGallery("post-1");
  assert.deepEqual(await listGallery("post-1"), []);
  const [post] = await database.rows(`select count(*) as total from posts`);
  assert.equal(Number(post.total), 1);
  assert.equal(fs.existsSync(path.join(mediaDir, images[0].replace("/uploads/media/", ""))), false);
});
