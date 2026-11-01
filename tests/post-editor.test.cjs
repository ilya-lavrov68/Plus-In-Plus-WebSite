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

const { Posts } = require("../payload/collections/posts.ts");
const { renderPostContent, renderPostMarkdown } = require("../lib/post-content.ts");

test("Payload Lexical is the only post editor and stores structured author content", () => {
  const content = Posts.fields.find((field) => field.name === "content");
  assert.equal(content.type, "richText");
  assert.equal(content.required, true);
  const config = fs.readFileSync(path.join(__dirname, "..", "payload.config.ts"), "utf8");
  assert.match(config, /editor: lexicalEditor\(\)/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "components", "admin", "post-content-editor.tsx")), false);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "app", "actions", "posts.ts")), false);
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
