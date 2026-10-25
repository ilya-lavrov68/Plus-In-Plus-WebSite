const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { mergeCatalogServices, mergeCatalogPosts, resolveServiceBySlug, STUDIO_BLOG_POSTS } = require("../lib/studio-catalog.ts");
const { localizeBlogPosts } = require("../lib/blog-localization.ts");
const messages = require("../messages/en.json");

function launchRow(overrides = {}) {
  const preset = STUDIO_BLOG_POSTS.find((post) => post.slug === "we-re-up-and-running");
  return {
    id: "launch-database-row",
    slug: preset.slug,
    title: preset.title,
    excerpt: preset.excerpt,
    content: `<p>${preset.excerpt}</p>`,
    coverImage: preset.image,
    images: null,
    readTime: preset.readTime,
    source: "manual",
    sourceUrl: null,
    isFeatured: false,
    publishedAt: new Date("2026-02-03T12:00:00Z"),
    createdAt: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  };
}

function translator(key, values = {}) {
  if (key === "readTime") return `${values.count} min`;
  return key;
}
translator.raw = (key) => messages.blog[key];

test("empty CMS query results never restore static service or blog presets", () => {
  assert.deepEqual(mergeCatalogServices([]), []);
  assert.deepEqual(mergeCatalogPosts([]), []);
  assert.equal(resolveServiceBySlug("sign-design", null), null);
});

test("blog presentation mapping never injects an unpublished launch post or replaces a DB slug", () => {
  const posts = mergeCatalogPosts([{
    id: "database-post",
    slug: "database-custom-slug",
    title: "Database-only post",
    excerpt: "Excerpt",
    content: "<p>Content</p>",
    coverImage: "/uploads/blog/database.webp",
    images: null,
    readTime: 5,
    source: "manual",
    sourceUrl: null,
    isFeatured: false,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  }]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, "database-post");
  assert.equal(posts[0].slug, "database-custom-slug");
  assert.equal(posts.some((post) => post.slug === "we-re-up-and-running"), false);
  assert.equal(posts[0].quote, undefined, "an excerpt is not article quote content");
  assert.equal(posts[0].quoteAttribution, undefined, "no studio attribution is invented");
  assert.equal(posts[0].author, undefined, "no editorial byline is invented");
});

test("only the exact untouched launch seed may use preset sections", () => {
  const preset = STUDIO_BLOG_POSTS.find((post) => post.slug === "we-re-up-and-running");
  const [legacy] = mergeCatalogPosts([launchRow()]);
  assert.equal(legacy.useLegacyLaunchCopy, true);
  assert.equal(legacy.sections, preset.sections);
  assert.equal(legacy.htmlContent, undefined);
  assert.equal(legacy.quote, preset.quote, "the authored preset quote remains explicit");
  assert.equal(legacy.author, preset.author, "the authored preset byline remains explicit");

  const editedRow = launchRow({
    title: "Edited in Admin",
    excerpt: "Database excerpt",
    content: "<h2>Database heading</h2><p>Database body</p>",
  });
  const [edited] = mergeCatalogPosts([editedRow]);
  assert.equal(edited.useLegacyLaunchCopy, false);
  assert.equal(edited.title, "Edited in Admin");
  assert.equal(edited.excerpt, "Database excerpt");
  assert.equal(edited.htmlContent, editedRow.content);
  assert.deepEqual(edited.sections, []);
  assert.equal(edited.lead, "Database excerpt");
});

test("a body-only Admin edit also disables the launch preset", () => {
  const [post] = mergeCatalogPosts([launchRow({ content: "<p>Replacement body</p>" })]);
  assert.equal(post.useLegacyLaunchCopy, false);
  assert.equal(post.htmlContent, "<p>Replacement body</p>");
  assert.deepEqual(post.sections, []);
});

test("blog localization formats the real publication timestamp in the active locale", () => {
  const publishedAt = new Date("2026-02-03T12:00:00Z");
  const [post] = mergeCatalogPosts([launchRow({ publishedAt })]);
  const [english] = localizeBlogPosts([post], translator, "en");
  const [russian] = localizeBlogPosts([post], translator, "ru");
  assert.equal(post.publishedAt, publishedAt);
  assert.match(english.dateLabel, /Feb 3, 2026/);
  assert.match(russian.dateLabel, /3 февр\. 2026/);
  assert.doesNotMatch(russian.dateLabel, /2020|2025/);
});
