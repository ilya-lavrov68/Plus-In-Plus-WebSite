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

test("белая кнопка при наведении просто немного темнеет", () => {
  const variants = read("components/ui/button-variants.ts");
  for (const variant of ["default", "primary", "cta"]) {
    const match = variants.match(new RegExp(`\\b${variant}:\\s*"([^"]*)"`));
    assert.ok(match, `не найден вариант ${variant}`);
    assert.match(match[1], /bg-foreground text-background/, `${variant}: в покое кнопка светлая`);
    assert.match(
      match[1],
      /hover:bg-foreground\/9\d/,
      `${variant}: ховер — та же светлая подложка, но чуть темнее`,
    );
    assert.equal(
      match[1].includes("hover:text-signal"),
      false,
      `${variant}: текст при наведении не меняет цвет`,
    );
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
  assert.equal(outline[1].includes("text-signal"), false, "прозрачная кнопка шапки остаётся нейтральной");
  const headerPrimary = headerVariants.match(/primary:\s*"([^"]*)"/);
  assert.match(headerPrimary[1], /hover:bg-foreground\/9\d/, "светлая кнопка шапки темнеет");
  assert.equal(
    headerPrimary[1].includes("text-signal"),
    false,
    "жёлтый текст в шапке не появляется",
  );
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
    navbar.includes("site-header-glass"),
    "шапка остаётся полупрозрачным стеклом с заметным блюром",
  );
  assert.ok(navbar.includes("text-foreground/75 hover:text-foreground"), "пункты меню — спокойный текст");
  assert.ok(navbar.includes("onPointerEnter"), "подменю открывается при наведении, а не только по клику");
  assert.equal(navbar.includes("menuItemClass"), false, "кнопок-чипов в шапке нет");
  assert.equal(navbar.includes("text-signal"), false, "триггер меню не перекрашивается в жёлтый");
  assert.equal(borderOffenders(navbar).length, 0, "у шапки и её элементов нет обводок");
});

test("интерактивные элементы показывают, что они интерактивны", () => {
  const globals = read("styles/globals.css");
  assert.match(globals, /button:not\(:disabled\)[^{]*\{[^}]*cursor: pointer/, "кнопки показывают курсор-руку");
  assert.match(globals, /cursor: not-allowed/, "недоступное действие показывает запрет");

  const sidebar = read("components/ui/sidebar.tsx");
  assert.ok(sidebar.includes("hover:bg-surface-container-high"), "пункт панели подсвечивается при наведении");
  assert.ok(sidebar.includes("data-[active=true]:bg-surface-container-highest"), "активный пункт отличается подложкой");
  assert.ok(sidebar.includes("before:bg-on-surface"), "активный пункт помечен полосой слева");
  assert.ok(sidebar.includes("cursor-pointer"), "пункт панели выглядит кликабельным");

  const hoverMenu = read("components/ui/use-hover-menu.ts");
  assert.ok(hoverMenu.includes("onPointerEnter"), "меню открывается наведением");
  assert.ok(hoverMenu.includes("onPointerLeave"), "меню закрывается с задержкой после ухода указателя");

  const adminSidebar = read("components/admin/admin-sidebar.tsx");
  assert.ok(adminSidebar.includes("useHoverMenu"), "меню админки использует общее поведение наведения");

  const serviceCard = read("components/site/service-card.tsx");
  assert.ok(serviceCard.includes("hover:bg-white/[0.04]"), "карточка услуги реагирует на наведение целиком");
});

test("плавающие панели остаются стеклянными", () => {
  const globals = read("styles/globals.css");
  const settings = read("app/(admin)/admin/settings/page.tsx");
  assert.ok(settings.includes("backdrop-blur"), "панель сохранения парит над контентом");

  const layout = read("app/(admin)/admin/layout.tsx");
  assert.ok(layout.includes("SidebarProvider"), "раскладка админки собрана на сайдбаре");

  const header = read("components/admin/admin-header.tsx");
  assert.ok(header.includes("backdrop-blur"), "шапка админки — стеклянная панель");
  assert.ok(header.includes("sticky"), "панель не уезжает при прокрутке");

  const navbar = read("components/blocks/navbar10.tsx");
  assert.ok(navbar.includes("site-header-glass"), "шапка сайта держит стекло на отдельном слое");
  assert.match(globals, /site-header-glass/, "стекло шапки объявлено в теме");
  assert.match(globals, /backdrop-filter: blur\(24px\) saturate\(140%\)/, "блюр шапки заметен");
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

test("тема админки доходит до элементов: цветовые роли объявлены inline", () => {
  const globals = read("styles/globals.css");

  // Обычный @theme фиксирует var(--md-*) на :root, где палитры .admin-md ещё нет:
  // в панели управления все поверхности и поля становились прозрачными.
  const inlineStart = globals.indexOf("@theme inline {");
  assert.ok(inlineStart > 0, "цветовые роли должны жить в @theme inline");
  const inlineBlock = globals.slice(inlineStart, globals.indexOf("\n}\n", inlineStart));

  for (const token of [
    "--color-surface: var(--md-surface);",
    "--color-surface-container-low: var(--md-surface-container-low);",
    "--color-surface-container-lowest: var(--md-surface-container-lowest);",
    "--color-surface-container-high: var(--md-surface-container-high);",
    "--color-on-surface: var(--md-on-surface);",
    "--color-on-surface-variant: var(--md-on-surface-variant);",
    "--color-outline-variant: var(--md-outline-variant);",
    "--color-background: hsl(var(--background));",
  ]) {
    assert.ok(inlineBlock.includes(token), `в inline-блоке нет ${token}`);
  }

  const plainTheme = globals.slice(globals.indexOf("@theme {"), inlineStart);
  assert.equal(
    /--color-[\w-]+:/.test(plainTheme),
    false,
    "цветовые токены не должны оставаться в обычном @theme",
  );

  const admin = globals.slice(globals.indexOf(".admin-md {"));
  for (const token of ["--md-surface:", "--md-surface-container-lowest:", "--md-on-surface:"]) {
    assert.ok(admin.includes(token), `.admin-md задаёт ${token}`);
  }
});

test("поле ввода читается: тёмная поверхность, хайрлайн и многострочный вариант", () => {
  const ui = read("components/admin/ui.tsx");
  const input = ui.match(/export const adminInputClass = `([^`]*)`/);
  assert.ok(input, "adminInputClass объявлен");
  assert.equal(input[1].includes("h-11"), true, "однострочное поле высотой h-11");
  // Поверхность поля общая для input и textarea — проверяем её объявление.
  const surface = ui.match(/const adminFieldSurface =\s*\n?\s*"([^"]*)"/);
  assert.ok(surface, "adminFieldSurface объявлен");
  assert.match(surface[1], /bg-surface-container-lowest/, "поле темнее панели");
  assert.match(surface[1], /ring-inset ring-outline-variant/, "край поля виден без внешней рамки");
  assert.match(surface[1], /focus-visible:outline-2/, "фокус показывается контуром");
  const textarea = ui.match(/export const adminTextareaClass = `([^`]*)`/);
  assert.ok(textarea, "есть класс textarea");
  assert.match(textarea[1], /min-h-24/, "многострочное поле выше однострочного");
  assert.equal(textarea[1].includes("h-11"), false, "высота не конфликтует с h-11");
  assert.match(ui, /export function AdminFieldGroup\(/, "есть группа полей с подписью");
  assert.match(ui, /hover:bg-on-surface\/8\d/, "светлая кнопка панели темнеет, а не перекрашивается");
  assert.equal(
    /filled: "[^"]*text-signal/.test(ui),
    false,
    "жёлтого текста на кнопках панели нет",
  );
});
