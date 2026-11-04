const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function filesUnder(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesUnder(path.join(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [path.join(dir, entry.name)]
          : [],
    );
}

const publicSources = [...filesUnder("components/site"), ...filesUnder("components/blocks"),
  ...filesUnder("components/ui"), ...filesUnder("app/(site)")];

/**
 * Обводка не является декором. Единственные исключения — нулевые и невидимые
 * служебные значения (`border-0`, `border-transparent`), разделители на
 * `bg-border` и focus-обводка для клавиатуры.
 */
const BORDER_TOKEN = /(?<![\w-])(?:[\w[\]&="'-]*:)*border(?:-[a-z0-9-]+)*(?:\/[\d.]+)?(?![\w-])/g;
const ALLOWED_BORDER = /(?:^|:)border(?:-0|-transparent|-collapse|-none|-color|-width|-style)$/;

function borderOffenders(source) {
  return (source.match(BORDER_TOKEN) || []).filter((token) => {
    const core = token.slice(token.lastIndexOf(":") + 1);
    if (ALLOWED_BORDER.test(core)) return false;
    if (core.startsWith("border-") && core.endsWith("-0")) return false;
    return true;
  });
}

test("жёлтым не заливают кнопки, переключатели и анимации", () => {
  const offenders = [];
  for (const file of publicSources) {
    for (const match of read(file).matchAll(/(?<![\w-])bg-primary(?:\/[\w.]+)?/g)) {
      offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], "жёлтый фон остался у кнопок или индикаторов");
});

test("белая кнопка темнеет и желтеет при наведении", () => {
  const variants = read("components/ui/button-variants.ts");
  for (const variant of ["default", "primary", "cta"]) {
    const match = variants.match(new RegExp(`\\b${variant}:\\s*"([^"]*)"`));
    assert.ok(match, `не найден вариант ${variant}`);
    assert.match(match[1], /bg-foreground text-background/, `${variant}: в покое кнопка светлая`);
    assert.match(match[1], /hover:bg-hover-surface hover:text-signal/, `${variant}: ховер — тёмная подложка + жёлтый текст`);
  }
});

test("прозрачные и тёмные кнопки не перекрашиваются в жёлтый", () => {
  const variants = read("components/ui/button-variants.ts");
  for (const variant of ["outline", "secondary", "ghost"]) {
    const match = variants.match(new RegExp(`\\b${variant}:\\s*"([^"]*)"`));
    assert.ok(match, `не найден вариант ${variant}`);
    assert.equal(match[1].includes("text-signal"), false, `${variant}: жёлтый предназначен белым кнопкам`);
    assert.match(match[1], /hover:bg-white\//, `${variant}: ховер остаётся нейтральным`);
  }

  const headerVariants = variants.slice(variants.indexOf("headerButtonVariants"));
  const outline = headerVariants.match(/outline:\s*"([^"]*)"/);
  assert.equal(outline[1].includes("text-signal"), false, "в шапке жёлтеет только светлая кнопка");
});

test("у интерфейса нет декоративных обводок", () => {
  const offenders = [];
  for (const file of publicSources) {
    for (const token of borderOffenders(read(file))) offenders.push(`${file}: ${token}`);
  }
  for (const file of [...filesUnder("components/admin"), ...filesUnder("components/orders"),
    ...filesUnder("app/(admin)"), ...filesUnder("components/ai")]) {
    for (const token of borderOffenders(read(file))) offenders.push(`${file}: ${token}`);
  }
  assert.deepEqual([...new Set(offenders)], [], "рамки вернулись в интерфейс");
});

test("состояние читается подложкой, а не рамкой", () => {
  const input = read("components/ui/input.tsx");
  assert.match(input, /bg-secondary\/60/, "поле ввода отделяется подложкой");
  assert.equal(borderOffenders(input).length, 0, "у поля ввода нет рамки");

  const badge = read("components/ui/badge.tsx");
  assert.match(badge, /bg-secondary\/70 text-foreground/, "вариант outline стал тихой подложкой");

  const accountModal = read("components/site/account-modal.tsx");
  assert.match(accountModal, /adminMode && "bg-secondary"/, "включённый режим админа подсвечен фоном");

  const serviceCard = read("components/site/service-card.tsx");
  assert.match(serviceCard, /selected \? "\s*bg-secondary/, "выбранная карточка отличается подложкой");
});

test("меню шапки — нейтральный текст без чипов и рамок", () => {
  const navbar = read("components/blocks/navbar10.tsx");
  assert.ok(
    navbar.includes("bg-background/65 backdrop-blur-2xl"),
    "шапка остаётся полупрозрачной, как в эталонном макете",
  );
  assert.ok(navbar.includes("text-foreground/70 hover:text-foreground"), "пункты меню — спокойный текст");
  assert.equal(navbar.includes("menuItemClass"), false, "кнопок-чипов в шапке нет");
  assert.equal(navbar.includes("text-signal"), false, "триггер меню не перекрашивается в жёлтый");
  assert.equal(borderOffenders(navbar).length, 0, "у шапки и её элементов нет обводок");
});

test("плавающие панели остаются стеклянными", () => {
  const settings = read("app/(admin)/admin/settings/page.tsx");
  assert.ok(settings.includes("backdrop-blur"), "панель сохранения парит над контентом");

  const layout = read("app/(admin)/admin/layout.tsx");
  assert.ok(layout.includes("backdrop-blur"), "сайдбар — стеклянная панель");
  assert.ok(layout.includes("lg:sticky"), "панель не уезжает при прокрутке");

  const navbar = read("components/blocks/navbar10.tsx");
  assert.ok(navbar.includes("backdrop-blur-2xl"), "шапка — эталон стекла");
});

test("жёлтый текст проходит контраст на своих поверхностях", () => {
  const globals = read("styles/globals.css");
  assert.ok(globals.includes("--color-signal: var(--md-signal)"), "утилиты text-signal должны существовать");
  assert.ok(globals.includes("--hover-surface: #242424"), "публичная подложка ховера");
  assert.ok(globals.includes("--md-signal: #FFFF01"), "публичный сигнальный жёлтый");
  assert.ok(globals.includes("--md-signal: #ece38a"), "в админке жёлтый мягче");

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

  assert.ok(ratio("#FFFF01", "#0a0a0a") >= 4.5, "публичный жёлтый текст читается на тёмном фоне");
  assert.ok(ratio("#FFFF01", "#242424") >= 4.5, "жёлтый текст читается на подложке белой кнопки");
  assert.ok(ratio("#ece38a", "#151517") >= 4.5, "жёлтый текст админки читается на фоне панели");
});
