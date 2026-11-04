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

test("меню админки собрано из кнопок без декоративных рамок", () => {
  const nav = read("components/admin/admin-nav.tsx");
  assert.ok(nav.includes("rounded-xl px-4"), "пункт меню — кнопка-плашка");
  assert.equal(/\bborder\b|border-signal|border-outline/.test(nav), false, "у пунктов меню нет обводок");
  assert.ok(nav.includes("hover:bg-hover-surface hover:text-signal"), "ховер пункта меню по общему правилу");
  assert.ok(nav.includes("bg-surface-container-high font-medium text-signal"), "активный раздел отмечен подложкой и текстом");
  assert.ok(nav.includes("aria-current"), "состояние дублируется для скринридера");
});

test("шапка плотная, а её меню — нейтральные поверхности без обводок", () => {
  const navbar = read("components/blocks/navbar10.tsx");
  // Шапка не должна «просвечивать»: раньше стояло bg-background/65 без разделителя.
  assert.ok(navbar.includes("bg-background/85 backdrop-blur-xl"), "фон шапки плотный, стекло сохранено");
  assert.equal(
    /fixed top-0 z-50[^"]*border-/.test(navbar),
    false,
    "у шапки нет линии-обводки по нижней кромке",
  );

  assert.ok(navbar.includes("const menuItemClass ="), "у пунктов меню общий класс");
  assert.ok(navbar.includes("rounded-none px-3 text-sm font-medium text-muted-foreground"), "пункт меню — нейтральная поверхность");
  assert.ok(navbar.includes("hover:bg-hover-surface hover:text-foreground"), "ховер — подложка и белый текст");
  assert.ok(navbar.includes("menuItemActiveClass"), "активный раздел отмечен подложкой");
  assert.ok(navbar.includes('aria-current={isActive ? "page" : undefined}'), "активный раздел доступен скринридеру");

  const menuClasses = navbar.match(/const menuItem(Class|ActiveClass) =[\s\S]*?;/g).join("\n");
  assert.equal(/\bborder\b|border-/.test(menuClasses), false, "у пунктов меню нет рамок");
  assert.equal(menuClasses.includes("text-signal"), false, "при наведении пункт меню не перекрашивается в жёлтый");
  assert.ok(
    navbar.includes("NavigationMenuTrigger className={menuItemClass}"),
    "триггер выпадающего раздела оформлен так же, как остальные пункты",
  );
  assert.equal(navbar.includes("menuButtonClass"), false, "старые кнопки-чипы с рамкой удалены");
});

test("плавающие части админки — плотное стекло, как шапка сайта", () => {
  const layout = read("app/(admin)/admin/layout.tsx");
  assert.ok(layout.includes("backdrop-blur-xl"), "сайдбар — стеклянная панель");
  assert.equal(/<aside className="[^"]*\bborder/.test(layout), false, "у сайдбара нет линий-разделителей");
  assert.ok(layout.includes("bg-surface/85"), "под стеклом плотная поверхность, панель не просвечивает");
  assert.ok(layout.includes("lg:sticky"), "панель не уезжает при прокрутке");

  const settings = read("app/(admin)/admin/settings/page.tsx");
  assert.ok(settings.includes("backdrop-blur-xl"), "панель сохранения парит над контентом");
  assert.equal(
    /sticky bottom-4[^"]*\bborder/.test(settings),
    false,
    "у плавающей панели нет обводки",
  );

  const header = read("components/blocks/navbar10.tsx");
  assert.ok(header.includes("backdrop-blur-xl"), "шапка остаётся стеклянной, но не прозрачной");
});
