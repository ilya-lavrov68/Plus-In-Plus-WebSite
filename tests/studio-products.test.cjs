const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Витрина продуктов студии.
 *
 * Проверяем правила, а не вёрстку: продукт попадает на сайт только из
 * админки, без публикации не виден, история версий приходит из репозитория, а
 * меню шапки не остаётся пустым на чистой установке.
 */

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("продукт публикуется и снимается из админки, а не правкой кода", () => {
  const queries = read("lib/studio-products.ts");
  assert.match(
    queries,
    /where is_published = 1/,
    "сайт читает только опубликованные продукты",
  );
  assert.match(queries, /export async function setStudioProductPublished/, "есть переключатель публикации");
  assert.match(queries, /export function studioProductPath/, "у продукта один адрес страницы");

  const actions = read("app/(admin)/admin/studio-products/actions.ts");
  assert.match(actions, /requireAdmin\(\)/, "публикация требует прав администратора");
  assert.match(actions, /toggleStudioProductPublishedAction/, "публикация доступна одной кнопкой из списка");
  assert.match(actions, /revalidatePath\("\/products\/" \+ input\.slug\)/, "правка продукта обновляет его страницу");
});

test("страница продукта — шаблон, а не отдельный файл под каждый продукт", () => {
  const page = read("app/(site)/products/[slug]/page.tsx");
  assert.match(page, /getStudioProductBySlug\(slug\)/, "страница берётся из записи продукта");
  assert.match(page, /if \(!product \|\| !product\.published\) notFound\(\)/, "неопубликованный продукт отдаёт 404");

  const view = read("components/site/product-template-view.tsx");
  for (const section of ["contactCta", "whatsNew", "aboutTitle"]) {
    assert.ok(view.includes(section), `в шаблоне есть секция ${section}`);
  }
  assert.match(view, /PageGlow preset="software"/, "фон шаблона — тот же, что у Line Launcher");
});

test("история версий подтягивается из репозитория продукта", () => {
  const sync = read("lib/studio-product-sync.ts");
  assert.match(sync, /CHANGELOG/i, "читается CHANGELOG.md репозитория");
  assert.match(sync, /\/tags\?per_page=100/, "читаются теги");
  assert.match(sync, /\/releases\?per_page=100/, "читаются релизы");
  assert.match(sync, /parseChangelog/, "разбор тот же, что у changelog:sync");
  assert.match(sync, /process\.env\.GITHUB_TOKEN/, "токен только из окружения и необязателен");

  const actions = read("app/(admin)/admin/studio-products/actions.ts");
  assert.match(actions, /fetchStudioChangelog/, "синхронизация запускается из админки");
  assert.match(actions, /saveStudioProductChangelog/, "результат сохраняется у продукта");
});

test("схема витрины догоняет код сама: no such table не роняет страницы", () => {
  const schema = read("lib/studio-products-schema.ts");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS/, "таблица создаётся идемпотентно");
  assert.match(schema, /ALTER TABLE `studio_products` ADD COLUMN `page_path`/, "поздние колонки добавляются");
  assert.match(schema, /let ensured: Promise<void> \| null = null/, "DDL выполняется один раз за процесс");

  const queries = read("lib/studio-products.ts");
  assert.match(
    queries,
    /export async function listStudioProducts\(\): Promise<StudioProduct\[]> \{\n  await ensureStudioProductsSchema\(\)/,
    "каждый запрос гарантирует схему перед чтением",
  );

  // Ошибка схемы не должна превращаться в 500 на сайте и стектрейс в админке.
  const adminPage = read("app/(admin)/admin/studio-products/page.tsx");
  assert.match(adminPage, /catch \(error\)/, "админка показывает текст ошибки вместо падения");
  const publicPage = read("app/(site)/products/[slug]/page.tsx");
  assert.match(publicPage, /getStudioProductBySlug\(slug\)\.catch\(\(\) => null\)/, "публичная страница отдаёт 404");

  // dev-сервер применяет схему сам — иначе после обновления ветки снова «no such table».
  const dev = read("scripts/dev.cjs");
  assert.match(dev, /db-migrate\.cjs/, "npm run dev сам применяет db/schema.sql");
});

test("загрузка — матрица «платформа × формат», а не одна ссылка", () => {
  const { buildFromAsset, buildsFromReleases } = require("../lib/studio-builds.ts");

  const builds = [
    ["Line.Launcher_0.15.4_x64-setup.exe", "Windows", ".exe"],
    ["Line.Launcher_0.15.4_x64_en-US.msi", "Windows", ".msi"],
    ["Line.Launcher_0.15.4_amd64.AppImage", "Linux", ".AppImage"],
    ["Line.Launcher_0.15.4_amd64.deb", "Linux", ".deb"],
  ];
  for (const [name, platform, format] of builds) {
    assert.deepEqual(
      buildFromAsset(name, "https://example.test/" + name),
      { platform, format, url: "https://example.test/" + name },
      `${name} разбирается в платформу и формат`,
    );
  }

  // Служебные файлы релиза в панель загрузки не попадают.
  assert.equal(buildFromAsset("latest.json", "https://example.test/latest.json"), null);
  assert.equal(buildFromAsset("app.exe.sig", "https://example.test/app.exe.sig"), null);

  const fromRelease = buildsFromReleases(
    [
      {
        tag_name: "v0.15.4",
        assets: [
          ...builds.map(([name]) => ({ name, browser_download_url: "https://example.test/" + name })),
          { name: "latest.json", browser_download_url: "https://example.test/latest.json" },
        ],
      },
    ],
    "0.15.4",
  );
  assert.deepEqual(
    fromRelease.map((build) => `${build.platform} ${build.format}`),
    ["Windows .exe", "Windows .msi", "Linux .AppImage", "Linux .deb"],
    "из релиза собирается таблица сборок",
  );

  // Таблица строк в админке и панель на странице продукта.
  const schema = read("lib/studio-products-schema.ts");
  assert.match(schema, /ADD COLUMN `downloads`/, "сборки хранятся списком");
  const form = read("components/admin/studio-product-form.tsx");
  assert.match(form, /name="downloads"/, "в админке — строки «платформа | формат | ссылка»");
  const view = read("components/site/product-template-view.tsx");
  assert.match(view, /groupDownloads\(product\.downloads\)/, "на странице сборки сгруппированы по платформам");
});

test("главная: первый экран с одной фразой и блок продукта из админки", () => {
  const page = read("app/(site)/page.tsx");
  assert.match(page, /<HomeProduct \/>/, "после первого экрана идёт продукт студии");
  assert.equal(page.includes("<BrandDirections />"), false, "направления бренда с главной убраны");
  assert.equal(page.includes("<Community />"), false, "партнёры переехали в подвал");

  const product = read("components/site/home-product.tsx");
  assert.match(product, /listPublishedStudioProducts/, "продукт берётся из админки");
  assert.match(product, /catch \{/, "падение базы не роняет главную");
  assert.match(product, /PRODUCTS\[0\]/, "на пустой базе работает реестр");

  const hero = read("components/blocks/hero138.tsx");
  assert.match(hero, /lead\?: string/, "первый экран принимает одну фразу о студии");
  assert.match(read("messages/ru.json"), /heroLine/, "фраза переводится");
});

test("меню шапки берёт продукты из админки, но не пустеет без базы", () => {
  const navbar = read("components/site/navbar.tsx");
  assert.match(navbar, /listPublishedStudioProducts/, "меню читает опубликованные продукты");
  assert.match(navbar, /catch \{/, "ошибка базы не роняет шапку");

  const block = read("components/blocks/navbar10.tsx");
  assert.match(
    block,
    /products\?\.length\s*\?\s*products\.map/,
    "опубликованные продукты приоритетнее реестра",
  );
  assert.match(block, /PRODUCTS\.map/, "на чистой установке работает статический реестр");
});
