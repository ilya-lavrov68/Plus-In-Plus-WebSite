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

const { savePost } = require("../app/(admin)/admin/posts/actions.ts");
const { deletePost, updatePost } = require("../lib/post-rules.ts");

const now = () => new Date().toISOString();

async function insertPost(overrides = {}) {
  const post = {
    id: "post-1",
    title: "Signage that works",
    slug: "signage-that-works",
    excerpt: "Short",
    content: "# Hello",
    readTime: 4,
    isPublished: false,
    isFeatured: false,
    publishedAt: null,
    ...overrides,
  };
  await database.exec(
    `insert into posts (id, title, slug, excerpt, content, read_time, source, is_featured, is_published,
       published_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?)`,
    [
      post.id,
      post.title,
      post.slug,
      post.excerpt,
      post.content,
      post.readTime,
      post.isFeatured ? 1 : 0,
      post.isPublished ? 1 : 0,
      post.publishedAt,
      now(),
      now(),
    ],
  );
  return post;
}

const base = {
  id: "post-1",
  title: "Signage that works",
  slug: "signage-that-works",
  excerpt: "Short",
  content: "# Hello",
  readTime: 4,
  sourceUrl: null,
  isPublished: false,
  isFeatured: false,
};

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

before(async () => {
  database = createTestDatabase("pip-posts-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from posts_rels`);
  await database.exec(`delete from posts`);
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

test("updatePost writes the fields, normalises the slug and clamps read time", async () => {
  await insertPost();
  await updatePost({
    ...base,
    title: "Brand new title",
    slug: "Brand New Title!",
    excerpt: "New excerpt",
    content: "Body",
    readTime: 999,
  });

  const [row] = await database.rows(
    `select title, slug, excerpt, content, read_time, is_published, published_at from posts where id = 'post-1'`,
  );
  assert.equal(row.title, "Brand new title");
  assert.equal(row.slug, "brand-new-title");
  assert.equal(row.excerpt, "New excerpt");
  assert.equal(row.content, "Body");
  assert.equal(Number(row.read_time), 60, "read time is clamped to 60");
  assert.equal(Number(row.is_published), 0);
  assert.equal(row.published_at, null);
});

test("publishing stamps the date once and unpublishing keeps it", async () => {
  await insertPost();
  await updatePost({ ...base, isPublished: true });
  const [published] = await database.rows(`select is_published, published_at from posts where id = 'post-1'`);
  assert.equal(Number(published.is_published), 1);
  assert.ok(published.published_at, "publishing sets published_at");

  await updatePost({ ...base, isPublished: false });
  const [unpublished] = await database.rows(`select is_published, published_at from posts where id = 'post-1'`);
  assert.equal(Number(unpublished.is_published), 0);
  assert.equal(unpublished.published_at, published.published_at, "the original date is preserved");
});

test("only one post stays featured", async () => {
  await insertPost({ id: "post-1", isPublished: true, publishedAt: now() });
  await insertPost({ id: "post-2", slug: "second", isPublished: true, publishedAt: now(), isFeatured: true });
  await updatePost({ ...base, id: "post-1", isPublished: true, isFeatured: true });

  const rows = await database.rows(`select id, is_featured from posts order by id`);
  assert.deepEqual(
    rows.map((row) => [row.id, Number(row.is_featured)]),
    [
      ["post-1", 1],
      ["post-2", 0],
    ],
  );
});

test("a draft or scheduled post cannot be featured", async () => {
  await insertPost();
  await assert.rejects(() => updatePost({ ...base, isPublished: false, isFeatured: true }), /только опубликованный/);

  await insertPost({ id: "post-2", slug: "future", isPublished: true, publishedAt: new Date(Date.now() + 86400000).toISOString() });
  await assert.rejects(
    () => updatePost({ ...base, id: "post-2", isPublished: true, isFeatured: true }),
    /Запланированный/,
  );
});

test("deletePost removes the post and its gallery rows", async () => {
  await insertPost();
  await database.exec(
    `insert into posts_rels ("order", parent_id, path, media_id) values (1, 'post-1', 'images', null)`,
  );
  await deletePost("post-1");
  const posts = await database.rows(`select id from posts`);
  const rels = await database.rows(`select id from posts_rels`);
  assert.deepEqual(posts, []);
  assert.deepEqual(rels, [], "gallery rows are removed with the post");
});

test("savePost is silent for a non-admin staff session", async () => {
  await insertPost();
  admin = null;
  await savePost(form({ id: "post-1", title: "Hacked" }));
  const [row] = await database.rows(`select title from posts where id = 'post-1'`);
  assert.equal(row.title, "Signage that works");
  assert.deepEqual(redirects, []);
});

test("savePost stores the post, logs the action and revalidates the blog", async () => {
  await insertPost();
  await assert.rejects(
    () =>
      savePost(
        form({
          id: "post-1",
          title: "Signage that works better",
          slug: "signage-that-works-better",
          excerpt: "Short",
          content: "Body",
          readTime: 6,
          isPublished: "on",
        }),
      ),
    /redirect:\/admin\/posts\/post-1\?saved=1/,
  );

  const [row] = await database.rows(`select title, slug, is_published, published_at from posts where id = 'post-1'`);
  assert.equal(row.title, "Signage that works better");
  assert.equal(row.slug, "signage-that-works-better");
  assert.equal(Number(row.is_published), 1);
  assert.ok(row.published_at);

  const [log] = await database.rows(`select action, actor_id_id from activity_logs where entity_id = 'post-1'`);
  assert.equal(log.action, "post.updated");
  assert.equal(log.actor_id_id, "usr-admin");

  for (const url of ["/admin/posts", "/blog", "/"]) {
    assert.ok(invalidated.includes(url), `${url} must be revalidated`);
  }
});

test("savePost refuses to feature a draft and explains why", async () => {
  await insertPost();
  await assert.rejects(
    () => savePost(form({ id: "post-1", title: "Signage that works", isFeatured: "on" })),
    /redirect:\/admin\/posts\/post-1\?error=/,
  );
  const [row] = await database.rows(`select is_featured from posts where id = 'post-1'`);
  assert.equal(Number(row.is_featured), 0);
});
