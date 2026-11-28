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
