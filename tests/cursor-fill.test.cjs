const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  buttonVariants,
  headerButtonVariants,
} = require("../components/ui/button-variants.ts");

test("primary actions are yellow pills, secondary actions are outlined pills", () => {
  for (const variant of ["default", "primary", "cta"]) {
    const classes = buttonVariants({ variant });
    assert.match(classes, /rounded-full/);
    assert.match(classes, /bg-primary/);
    assert.match(classes, /hover:bg-brand-signal-strong/);
    assert.doesNotMatch(classes, /rounded-none/);
  }
  assert.match(headerButtonVariants({ variant: "primary" }), /rounded-full/);
  for (const variant of ["outline", "secondary"]) {
    const classes = buttonVariants({ variant });
    assert.match(classes, /rounded-full/);
    assert.match(classes, /bg-transparent/);
    assert.match(classes, /border-border|border-foreground/);
  }
});

test("design tokens follow the payloadcms.com structure without shadows", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");

  // Формы: мягкие радиусы вместо прямых углов, pill у кнопок.
  assert.match(css, /--radius-lg: 14px;/);
  assert.match(css, /--radius: 14px;/);
  assert.match(css, /\.pip-mono \{/);
  assert.match(css, /\.pip-card \{[^}]*border-radius: var\(--radius-lg\)/s);
  assert.match(css, /\.pip-media-frame \{/);

  // Жёлтый — единственный акцент; пурпур остаётся в резерве и не красит кнопки.
  assert.match(css, /--primary: #FFFF01;/);
  const buttonBlock = css.slice(css.indexOf(".pip-cursor-fill {"));
  assert.doesNotMatch(buttonBlock.slice(0, buttonBlock.indexOf("@media")), /--pip-violet/);

  // Тени остаются запрещены.
  const shadowLines = css
    .split("\n")
    .filter((line) => /(?:box|text)-shadow/.test(line) && !/:\s*none/.test(line));
  assert.deepEqual(shadowLines, []);
});
