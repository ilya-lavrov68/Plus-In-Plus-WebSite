const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const globals = fs.readFileSync(path.join(root, "styles", "globals.css"), "utf8");

/** Все объявленные в теме приложения CSS-переменные. */
function declaredVariables() {
  return new Set([...globals.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
}

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Регресс-тест на баг, из-за которого «Настройки» выглядели сломанными:
 * разметка ссылалась на `--brand-signal`, `--pip-signal` и `--pip-violet`,
 * а объявлены они не были — CSS для таких классов просто не генерировался,
 * кнопки и фокус-рамки админки оставались невидимыми.
 */
test("каждая CSS-переменная, на которую ссылается админка, объявлена в globals.css", () => {
  const declared = declaredVariables();
  const referenced = new Map();

  for (const file of [
    ...filesUnder(path.join(root, "app", "(admin)")),
    ...filesUnder(path.join(root, "components", "admin")),
  ]) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/var\((--[a-z0-9-]+)/gi)) {
      if (!referenced.has(match[1])) referenced.set(match[1], path.relative(root, file));
    }
  }

  const missing = [...referenced.entries()].filter(([name]) => !declared.has(name));
  assert.deepEqual(
    missing,
    [],
    `переменные без объявления: ${missing.map(([name, file]) => `${name} (${file})`).join(", ")}`,
  );
});

test("палитра Material 3 объявлена в области админки, а не глобально", () => {
  const adminBlock = globals.slice(globals.indexOf(".admin-md {"));
  for (const token of ["--md-primary", "--md-on-primary", "--md-surface", "--md-on-surface", "--md-outline"]) {
    assert.ok(adminBlock.includes(token), `в .admin-md нет ${token}`);
  }
  const rootBlock = globals.slice(0, globals.indexOf(".admin-md {"));
  assert.equal(rootBlock.includes("--md-surface:"), false, "MD3-поверхности не должны утекать на публичный сайт");
});

test("контраст ролей MD3 не ниже 4.5:1 для текста", () => {
  const pick = (name) => {
    const match = globals.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{6})`, "i"));
    assert.ok(match, `не найден цвет ${name}`);
    return match[1];
  };
  const luminance = (hex) => {
    const [r, g, b] = hex
      .replace("#", "")
      .match(/../g)
      .map((part) => parseInt(part, 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (foreground, background) => {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  };

  const pairs = [
    ["--md-on-surface", "--md-surface"],
    ["--md-on-surface-variant", "--md-surface-container"],
    ["--md-on-surface-variant", "--md-surface-container-high"],
    ["--md-on-primary", "--md-primary"],
    ["--md-on-primary-container", "--md-primary-container"],
    ["--md-on-secondary-container", "--md-secondary-container"],
    ["--md-on-tertiary-container", "--md-tertiary-container"],
    ["--md-on-error-container", "--md-error-container"],
    ["--md-primary", "--md-surface"],
  ];

  for (const [foreground, background] of pairs) {
    const value = ratio(pick(foreground), pick(background));
    assert.ok(value >= 4.5, `${foreground} на ${background} = ${value.toFixed(2)}:1, нужно ≥ 4.5:1`);
  }
});
