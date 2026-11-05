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

/**
 * Цветовые роли Tailwind: `@theme` объявляет `--color-x`, класс `bg-x`
 * генерируется только при наличии этого объявления.
 */
function declaredThemeColors() {
  const theme = globals.slice(globals.indexOf("@theme"), globals.indexOf("@utility container"));
  return new Set([...theme.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const adminFiles = [
  ...filesUnder(path.join(root, "app", "(admin)")),
  ...filesUnder(path.join(root, "components", "admin")),
  path.join(root, "components", "ui", "table.tsx"),
];

/** Палитра админки: `.admin-md` — единственное место, где живут значения MD3. */
function paletteValue(name) {
  const adminBlock = globals.slice(globals.indexOf(".admin-md {"));
  const match = adminBlock.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `не найден цвет ${name} в .admin-md`);
  return match[1];
}

function luminance(hex) {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const [light, dark] = [luminance(paletteValue(foreground)), luminance(paletteValue(background))].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
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

  for (const file of adminFiles) {
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

/**
 * Вторая половина того же бага и причина «на кнопках не видно текста»:
 * класс `text-on-primary` использовался, но `--color-on-primary` в теме не
 * существовал — заливная кнопка получала светлый унаследованный текст на
 * светлой заливке. Тест ловит любую такую утилиту.
 */
test("каждый цветовой класс админки есть в теме приложения", () => {
  const declared = declaredThemeColors();
  // Встроенная палитра Tailwind и служебные значения — не токены темы.
  const builtin = new Set(
    "white black transparent current inherit slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose".split(
      " ",
    ),
  );
  const notAColor = new Set(
    "xs sm base lg xl 2xl 3xl 4xl 5xl 6xl left right center justify start end top bottom middle wrap nowrap balance pretty clip ellipsis none auto inverse hidden inset solid dashed dotted double offset-2 b color".split(
      " ",
    ),
  );

  const unknown = new Map();
  for (const file of adminFiles) {
    const source = fs
      .readFileSync(file, "utf8")
      // Комментарии и подсвеченные кодом имена в прозе — не разметка.
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1 ")
      .replace(/`[^`]*`/g, " ")
      // Ссылки на CSS-переменные в атрибутах SVG — не классы утилит.
      .replace(/var\(--[a-z0-9-]+\)/g, " ")
      // Варианты в квадратных скобках и служебные `data-[…]` не описывают цвет.
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/data-\S+/g, " ");
    for (const match of source.matchAll(
      /\b(?:[a-z0-9-]+:)*(?:bg|text|border|outline|fill|stroke|divide|from|via|to|ring|decoration)-([a-z][a-z0-9-]*)\b/g,
    )) {
      const name = match[1];
      if (name.length < 2) continue;
      if (builtin.has(name) || declared.has(name) || notAColor.has(name)) continue;
      if (/^b(-\d+)?$/.test(name)) continue;
      if (!unknown.has(name)) unknown.set(name, new Set());
      unknown.get(name).add(path.relative(root, file));
    }
  }

  assert.deepEqual(
    [...unknown].map(([name, files]) => `${name} ← ${[...files].join(", ")}`),
    [],
    "классы без объявленного цвета не дают CSS, текст таких кнопок наследуется",
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
  const pairs = [
    ["--md-on-surface", "--md-surface"],
    ["--md-on-surface", "--md-surface-container-low"],
    ["--md-on-surface", "--md-surface-container-high"],
    ["--md-on-surface-variant", "--md-surface"],
    ["--md-on-surface-variant", "--md-surface-container"],
    ["--md-on-surface-variant", "--md-surface-container-highest"],
    ["--md-on-primary", "--md-primary"],
    ["--md-on-secondary", "--md-secondary"],
    ["--md-on-primary-container", "--md-primary-container"],
    ["--md-on-secondary-container", "--md-secondary-container"],
    ["--md-on-tertiary-container", "--md-tertiary-container"],
    ["--md-on-error-container", "--md-error-container"],
    ["--md-primary", "--md-surface"],
    ["--md-error", "--md-surface"],
  ];

  for (const [foreground, background] of pairs) {
    const value = ratio(foreground, background);
    assert.ok(value >= 4.5, `${foreground} на ${background} = ${value.toFixed(2)}:1, нужно ≥ 4.5:1`);
  }
});

/**
 * Верхняя граница нужна не для доступности, а для комфорта: первый заход дал
 * 13.6:1 на заливной кнопке и неоновый `#FFFF01` на каждом экране — читаемо,
 * но глаз быстро устаёт. Держим текст в полосе 4.5–13:1, заливку CTA ≤ 9.5:1.
 */
test("контраст не выходит за комфортную верхнюю границу", () => {
  const textPairs = [
    ["--md-on-surface", "--md-surface"],
    ["--md-on-surface-variant", "--md-surface"],
    ["--md-on-primary-container", "--md-primary-container"],
    ["--md-on-secondary-container", "--md-secondary-container"],
  ];
  for (const [foreground, background] of textPairs) {
    const value = ratio(foreground, background);
    assert.ok(value <= 13, `${foreground} на ${background} = ${value.toFixed(2)}:1, многовато для долгой работы`);
  }

  const button = ratio("--md-on-primary", "--md-primary");
  assert.ok(button <= 9.5, `заливная кнопка даёт ${button.toFixed(2)}:1 — слишком резко`);

  const fill = ratio("--md-primary", "--md-surface");
  assert.ok(fill <= 11, `заливка CTA на фоне ${fill.toFixed(2)}:1 — кнопка «кричит»`);
});
