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

const { renderPostContent, renderPostMarkdown } = require("../lib/post-content.ts");
const { lexicalToHtml } = require("../lib/lexical-html.ts");

test("post content is stored as Lexical JSON and rendered by our own converter", () => {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  assert.match(schema, /CREATE TABLE `posts`[\s\S]*?`content` text/);
  // Конвертер живёт в проекте: пакет CMS удалён вместе с редактором.
  const document = {
    root: {
      children: [
        { type: "heading", tag: "h2", children: [{ type: "text", text: "Author heading", format: 0 }] },
        { type: "paragraph", children: [
          { type: "text", text: "Bold", format: 1 },
          { type: "text", text: " and ", format: 0 },
          { type: "text", text: "italic", format: 2 },
        ] },
        { type: "list", listType: "bullet", children: [{ type: "listitem", children: [{ type: "text", text: "One", format: 0 }] }] },
        { type: "link", fields: { url: "javascript:alert(1)" }, children: [{ type: "text", text: "bad", format: 0 }] },
      ],
    },
  };
  const html = lexicalToHtml(document);
  assert.match(html, /<h2>Author heading<\/h2>/);
  assert.match(html, /<strong>Bold<\/strong> and <em>italic<\/em>/);
  assert.match(html, /<ul><li>One<\/li><\/ul>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.equal(lexicalToHtml({}), null);
});

test("Lexical HTML is sanitized again at the public rendering boundary", () => {
  const html = renderPostContent('<h2>Safe heading</h2><p onclick="alert(1)">Text</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>');
  assert.match(html, /<h2>Safe heading<\/h2>/);
  assert.match(html, /<p>Text<\/p>/);
  assert.doesNotMatch(html, /script|onclick|iframe|evil\.test/i);
});

test("legacy Markdown drafts still render without executing raw HTML", () => {
  const html = renderPostMarkdown('## Author heading\n\nRaw <b>source</b> is text.\n\n![Local](/uploads/media/image.webp)\n\n![Remote](https://evil.test/image.png)');
  assert.match(html, /<h2>Author heading<\/h2>/);
  assert.match(html, /&lt;b&gt;source&lt;\/b&gt;/);
  assert.match(html, /<img[^>]+loading="lazy"[^>]+decoding="async"/);
  assert.doesNotMatch(html, /evil\.test/);
});

test("author Canva embeds remain normalized, lazy and restricted to Canva", () => {
  const accepted = renderPostMarkdown(':::canva\nhttps://www.canva.com/design/ABC_123/view\n:::');
  assert.match(accepted, /<div class="article-canva"><iframe/);
  assert.match(accepted, /loading="lazy"/);
  assert.match(accepted, /referrerpolicy="strict-origin-when-cross-origin"/);
  const rejected = renderPostMarkdown(':::canva\nhttps://evil.test/design/ABC_123/view\n:::');
  assert.doesNotMatch(rejected, /iframe|article-canva/);
});
