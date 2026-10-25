const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename,
    );
}

let dbPosts = [];
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/navigation") {
    return { notFound: () => { throw new Error("NOT_FOUND"); } };
  }
  if (name === "@/components/blocks/blog11") return { Blog11: () => null };
  if (name === "@/components/blocks/blogpost11") return { Blogpost11: () => null };
  if (name === "@/lib/data") return { getPublishedPosts: async () => dbPosts };
  if (name === "@/lib/request-locale") return { getRequestLocale: async () => "en" };
  if (name === "@/lib/server-i18n") {
    const translator = (key, values = {}) =>
      key === "readTime" ? `${values.count} min` : key;
    translator.raw = () => undefined;
    return { getRequestTranslations: async () => translator };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const BlogPostContent = require("../app/blog/[slug]/content.tsx").default;

function row(content) {
  return {
    id: "public-post",
    slug: "public-post",
    title: "Author-controlled post",
    excerpt: "Author excerpt, not a quote",
    content,
    coverImage: "/uploads/blog/cover.webp",
    images: null,
    readTime: 5,
    source: "manual",
    sourceUrl: null,
    isFeatured: false,
    publishedAt: new Date("2026-10-01T12:00:00Z"),
    createdAt: new Date("2026-10-01T12:00:00Z"),
  };
}

async function renderedPost(content) {
  dbPosts = [row(content)];
  const tree = await BlogPostContent({ slug: "public-post" });
  return tree.props.children[0].props.post;
}

test("the public article route renders stored Markdown to sanitized HTML without generated quote material", async () => {
  const post = await renderedPost([
    "<!-- pip:markdown -->",
    "## Markdown heading",
    "",
    "Raw <script>alert(1)</script> remains inert.",
    "",
    "![Remote](https://evil.example/pixel.png)",
    "",
    ":::canva",
    "https://www.canva.com/design/ABC_123/view",
    ":::",
  ].join("\n"));

  assert.match(post.htmlContent, /<h2>Markdown heading<\/h2>/);
  assert.match(post.htmlContent, /<div class="article-canva"><iframe/);
  assert.doesNotMatch(post.htmlContent, /<script|<img|pip:markdown/i);
  assert.equal(post.quote, undefined);
  assert.equal(post.quoteAttribution, undefined);
  assert.equal(post.author, undefined);
  assert.equal(post.htmlContent.includes("Author excerpt, not a quote"), false);
});

test("the public route also re-sanitizes legacy HTML already stored in the database", async () => {
  const post = await renderedPost(
    '<p onclick="alert(1)">Legacy body</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>',
  );
  assert.equal(post.htmlContent, "<p>Legacy body</p>");
});
