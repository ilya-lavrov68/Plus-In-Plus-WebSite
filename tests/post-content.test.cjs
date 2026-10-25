const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const {
  renderPostContent,
  renderPostMarkdown,
} = require("../lib/post-content.ts");
const {
  insertMarkdownBlockAtCursor,
  isMarkdownPostContent,
  markdownSource,
  normalizeMarkdownSource,
  POST_MARKDOWN_MARKER,
  toMarkdownPostContent,
} = require("../lib/post-content-format.ts");
const { normalizeCanvaEmbedUrl } = require("../lib/canva.ts");
const { sanitizePostContent } = require("../lib/sanitize-post-content.ts");

test("Markdown renders authored headings, lists, tables, local images and explicit footnotes", () => {
  const html = renderPostMarkdown([
    "## Author heading",
    "",
    "- First item",
    "- Second item",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    "| Reach | 42 |",
    "",
    "![Local chart](/uploads/blog/chart.webp \"Chart title\")",
    "",
    "A statement with an author note.[^1]",
    "",
    "[^1]: The exact note supplied by the author.",
  ].join("\n"));

  assert.match(html, /<h2>Author heading<\/h2>/);
  assert.match(html, /<ul>[\s\S]*<li>First item<\/li>/);
  assert.match(html, /<div class="article-table-scroll"><table>/);
  assert.match(html, /<td align="right">42<\/td>/);
  assert.match(html, /<img src="\/uploads\/blog\/chart.webp" alt="Local chart" title="Chart title" loading="lazy" decoding="async"\s*\/>/);
  assert.match(html, /class="footnotes"/);
  assert.match(html, /The exact note supplied by the author/);
  assert.doesNotMatch(html, /Plus In Plus Studio|Plus In Plus Editorial/);
});

test("Markdown never activates raw HTML, remote images or unsafe links", () => {
  const html = renderPostMarkdown([
    "<script>alert(1)</script>",
    "<iframe src=\"https://evil.example/embed\"></iframe>",
    "![Remote tracker](https://evil.example/pixel.png)",
    "![Traversal](/uploads/../secret.png)",
    "[Unsafe](javascript:alert(1))",
  ].join("\n\n"));

  assert.doesNotMatch(html, /<script|<iframe|onload=|href="javascript:/i);
  assert.doesNotMatch(html, /<img[^>]+https?:\/\//i);
  assert.doesNotMatch(html, /<img[^>]+secret\.png/i);
  assert.match(html, /Remote tracker/);
});

test("an explicit Canva block becomes one normalized responsive embed at its authored position", () => {
  const html = renderPostMarkdown([
    "Explanation before the graph.",
    "",
    ":::canva",
    "https://canva.com/design/DESIGN_123/token_ABC/view?utm_source=author",
    ":::",
    "",
    "Explanation after the graph.",
  ].join("\n"));

  assert.match(html, /Explanation before the graph[\s\S]*<div class="article-canva"><iframe src="https:\/\/www\.canva\.com\/design\/DESIGN_123\/token_ABC\/view\?embed" title="Canva design" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen="allowfullscreen" class="article-canva-frame"><\/iframe><\/div>[\s\S]*Explanation after the graph/);
  assert.equal((html.match(/<iframe/g) ?? []).length, 1);
  assert.doesNotMatch(html, /utm_source/);
});

test("Canva accepts only HTTPS design view URLs, never short links or arbitrary pages", () => {
  const valid = "https://www.canva.com/design/DESIGN-1/view";
  assert.equal(normalizeCanvaEmbedUrl(valid), `${valid}?embed`);
  for (const value of [
    "http://www.canva.com/design/DESIGN-1/view",
    "https://evil.example/design/DESIGN-1/view",
    "https://www.canva.com.evil.example/design/DESIGN-1/view",
    "https://user@www.canva.com/design/DESIGN-1/view",
    "https://www.canva.com/design/DESIGN-1/edit",
    "https://canva.me/design/DESIGN-1/view",
  ]) {
    assert.equal(normalizeCanvaEmbedUrl(value), null, value);
    assert.doesNotMatch(renderPostMarkdown(`:::canva\n${value}\n:::`), /<iframe/i);
  }
});

test("the HTML sanitizer has the same narrow Canva exception and keeps rejecting other frames", () => {
  const html = sanitizePostContent([
    '<iframe src="https://www.canva.com/design/ABC_123/view" onload="alert(1)" width="999"></iframe>',
    '<iframe src="https://www.canva.com/design/ABC_123/edit"></iframe>',
    '<iframe src="https://evil.example/design/ABC_123/view"></iframe>',
    '<img src="https://evil.example/pixel.png">',
    '<img src="/assets/chart.png" onerror="alert(1)">',
  ].join(""));

  assert.equal((html.match(/<iframe/g) ?? []).length, 1);
  assert.match(html, /src="https:\/\/www\.canva\.com\/design\/ABC_123\/view\?embed"/);
  assert.match(html, /class="article-canva-frame"/);
  assert.doesNotMatch(html, /onload|onerror|width="999"|evil\.example|\/edit/);
  assert.equal((html.match(/<img/g) ?? []).length, 1);
  assert.match(html, /<img src="\/assets\/chart\.png"\s*\/?>/);
});

test("existing rich-text tags and anchors survive while arbitrary inline CSS does not", () => {
  const html = sanitizePostContent(
    '<h1>Heading</h1><p style="position:fixed">Text <del>old</del> <i>italic</i> <sub>sub</sub></p><a name="section">Anchor</a>',
  );
  assert.equal(
    html,
    '<h1>Heading</h1><p>Text <del>old</del> <i>italic</i> <sub>sub</sub></p><a name="section">Anchor</a>',
  );
});

test("stored Markdown round-trips losslessly and marked content is rendered only on output", () => {
  const source = normalizeMarkdownSource("\uFEFF## Draft\r\n\r\nRaw <b>source</b> stays editable.[^1]\r\n[^1]: Note\r\n");
  const stored = toMarkdownPostContent(source);
  assert.equal(isMarkdownPostContent(stored), true);
  assert.equal(markdownSource(stored), source);
  assert.ok(stored.startsWith(`${POST_MARKDOWN_MARKER}\n`));
  assert.equal(isMarkdownPostContent("<p>HTML post</p>"), false);

  const html = renderPostContent(stored);
  assert.match(html, /<h2>Draft<\/h2>/);
  assert.doesNotMatch(html, /<b>source<\/b>|pip:markdown/);
  assert.match(html, /Raw &lt;b&gt;source&lt;\/b&gt; stays editable/);
  assert.equal(renderPostContent("<p>HTML post</p>"), "<p>HTML post</p>");
});

test("Markdown block insertion respects the current selection and surrounding newlines", () => {
  const source = "Before\n\nAfter";
  const result = insertMarkdownBlockAtCursor(source, 6, 6, ":::canva\nhttps://www.canva.com/design/ABC/view?embed\n:::");
  assert.equal(
    result.value,
    "Before\n\n:::canva\nhttps://www.canva.com/design/ABC/view?embed\n:::\n\nAfter",
  );
  assert.equal(result.value.slice(result.cursor), "\n\nAfter");
  assert.equal(insertMarkdownBlockAtCursor("Before", 6, 6, "Block").value, "Before\n\nBlock\n\n");
});
