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

const publicSources = [...filesUnder("components/site"), ...filesUnder("components/blocks")];

/**
 * Правило палитры: жёлтый — акцент текста, а не заливка.
 * Раньше основная кнопка была жёлтой плашкой с тёмным текстом; теперь кнопка
 * белая, а жёлтым становится сам текст при наведении на тёмно-серой подложке.
 */
test("кнопки не заливаются фирменным жёлтым", () => {
  const variants = read("components/ui/button-variants.ts");
  for (const variant of ['default:\n          "bg-foreground text-background', 'primary:\n          "bg-foreground text-background', 'cta:\n          "bg-foreground text-background']) {
    assert.ok(variants.includes(variant), `вариант кнопки должен быть белым: ${variant.slice(0, 12)}`);
  }
  assert.equal(variants.includes("bg-primary"), false, "кнопки больше не красятся в жёлтый");
  assert.ok(variants.includes("hover:bg-hover-surface hover:text-signal"), "ховер — тёмная подложка + жёлтый текст");

  const headerVariants = variants.slice(variants.indexOf("headerButtonVariants"));
  assert.equal(headerVariants.includes("bg-primary"), false, "кнопки в шапке следуют тому же правилу");
});

test("в публичных компонентах нет жёлтых заливок, только текстовый акцент", () => {
  const offenders = [];
  for (const file of publicSources) {
    const source = read(file);
    for (const match of source.matchAll(/(?<![\w-])bg-primary(?![\w-])(\/[a-z0-9]+)?/g)) {
      // Полупрозрачная подложка под жёлтым текстом — это акцент, а не заливка.
      if (match[1] && Number(match[1].slice(1)) <= 20) continue;
      offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], "жёлтый фон остался у кнопок, переключателей или анимаций");
});

test("акцентный жёлтый объявлен отдельным токеном и имеет контраст с фоном", () => {
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
  assert.ok(ratio("#ece38a", "#2e2e35") >= 4.5, "жёлтый текст админки читается на подложке ховера");
  assert.ok(ratio("#ece38a", "#151517") >= 4.5, "жёлтый текст админки читается на фоне панели");
});

test("кнопки админки: спокойная подложка и жёлтый текст при наведении", () => {
  const ui = read("components/admin/ui.tsx");
  const variantsBlock = ui.slice(ui.indexOf("const adminButtonVariants"), ui.indexOf("const adminButtonSizes"));
  assert.equal(variantsBlock.includes("bg-primary"), false, "заливных жёлтых кнопок в панели нет");
  for (const variant of ["filled", "tonal", "outlined", "text"]) {
    const match = variantsBlock.match(new RegExp(`\\b${variant}:\\s*"([^"]*)"`));
    assert.ok(match, `не найден вариант ${variant}`);
    assert.ok(match[1].includes("hover:text-signal"), `${variant}: при наведении текст должен желтеть`);
  }
  assert.ok(ui.includes("adminButton("), "варианты кнопок собираются одной функцией");
});

test("меню админки собрано из кнопок, а не из текстовых ссылок", () => {
  const nav = read("components/admin/admin-nav.tsx");
  assert.ok(nav.includes("rounded-xl border px-4"), "пункт меню — кнопка с рамкой");
  assert.ok(nav.includes("hover:bg-hover-surface hover:text-signal"), "ховер пункта меню по общему правилу");
  assert.ok(nav.includes("border-signal/45"), "активный раздел помечен жёлтой рамкой и текстом");
  assert.ok(nav.includes("aria-current"), "состояние дублируется для скринридера");
});

test("меню шапки собрано из кнопок с общим ховером", () => {
  const navbar = read("components/blocks/navbar10.tsx");
  assert.ok(navbar.includes("const menuButtonClass ="), "у пунктов меню общий класс-кнопка");
  assert.ok(navbar.includes("hover:bg-hover-surface hover:text-signal"), "ховер пункта меню по общему правилу");
  assert.ok(navbar.includes('data-[state=open]:bg-hover-surface'), "раскрытый раздел остаётся подсвеченным");
  assert.ok(
    navbar.includes("NavigationMenuTrigger className={menuButtonClass}"),
    "заголовок выпадающего меню — кнопка",
  );
  assert.ok(
    navbar.includes("className={menuButtonClass}") &&
      navbar.includes("AccordionTrigger className={mobileMenuButtonClass}"),
    "плоские ссылки и мобильные разделы используют те же кнопки",
  );
  assert.equal(
    navbar.includes("navigationMenuTriggerStyle"),
    false,
    "текстовый стиль триггера больше не используется",
  );
});

test("плавающие части админки используют сильный blur, как шапка сайта", () => {
  const layout = read("app/(admin)/admin/layout.tsx");
  assert.ok(layout.includes("backdrop-blur-2xl"), "сайдбар — стеклянная панель");
  assert.ok(layout.includes("bg-surface/60"), "под стеклом полупрозрачная поверхность");
  assert.ok(layout.includes("lg:sticky"), "панель не уезжает при прокрутке");

  const settings = read("app/(admin)/admin/settings/page.tsx");
  assert.ok(settings.includes("backdrop-blur-2xl"), "панель сохранения парит над контентом");

  const header = read("components/blocks/navbar10.tsx");
  assert.ok(header.includes("backdrop-blur-2xl"), "шапка сайта остаётся эталоном стекла");
});
