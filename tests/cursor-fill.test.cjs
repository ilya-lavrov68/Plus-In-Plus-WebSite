const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  buttonVariants,
  headerButtonVariants,
} = require("../components/ui/button-variants.ts");

test("primary actions are sharp and filled, secondary actions stay transparent pills", () => {
  for (const variant of ["default", "primary", "cta"]) {
    assert.match(buttonVariants({ variant }), /pip-cursor-fill/);
    assert.match(buttonVariants({ variant }), /bg-primary/);
    assert.match(buttonVariants({ variant }), /rounded-none/);
  }
  assert.match(headerButtonVariants({ variant: "primary" }), /pip-cursor-fill/);
  for (const variant of ["outline", "secondary"]) {
    assert.doesNotMatch(buttonVariants({ variant }), /pip-cursor-fill/);
    assert.match(buttonVariants({ variant }), /rounded-full/);
    assert.match(buttonVariants({ variant }), /bg-transparent/);
    assert.match(buttonVariants({ variant }), /border-border|border-foreground/);
  }
});

test("hover fill is a fast large-pixel wipe, not a wave from the pointer", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");

  assert.match(css, /\.pip-cursor-fill \{[^}]*background-color: var\(--pip-signal\)/s);
  assert.match(css, /\.pip-cursor-fill::before \{[^}]*background-color: var\(--pip-signal-strong\)/s);
  assert.match(css, /\.pip-cursor-fill::before \{[^}]*repeating-conic-gradient/s);
  assert.match(css, /\.pip-cursor-fill::before \{[^}]*clip-path: inset\(0 100% 0 0\)/s);
  assert.match(css, /\.pip-cursor-fill::before \{[^}]*steps\(6, end\)/s);
  assert.match(css, /\.pip-cursor-fill:hover::before,[\s\S]*?clip-path: inset\(0 0 0 0\)/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.pip-cursor-fill::before[\s\S]*?transition: none/);

  // Пурпур сохраняется в палитре, но в анимации кнопок не участвует.
  const fill = css.slice(css.indexOf(".pip-cursor-fill {"));
  const fillBlock = fill.slice(0, fill.indexOf("@media (prefers-reduced-motion"));
  assert.doesNotMatch(fillBlock, /--pip-violet/);
  assert.doesNotMatch(fillBlock, /radial-gradient/);

  assert.equal(
    fs.existsSync(path.resolve(__dirname, "../components/site/cursor-fill-controller.tsx")),
    false,
    "point-origin controller must be removed with the old animation"
  );
  const providers = fs.readFileSync(path.resolve(__dirname, "../app/providers.tsx"), "utf8");
  assert.doesNotMatch(providers, /CursorFillController/);
});
