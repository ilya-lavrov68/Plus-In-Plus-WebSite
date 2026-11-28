import { sourceArchives } from "@/lib/studio-builds";
import { PRODUCTS } from "@/lib/products";
import { getDb, rows, run } from "@/lib/db";

/**
 * Самовосстановление схемы витрины продуктов.
 *
 * Таблица `studio_products` появилась позже остальных, поэтому на базе,
 * поднятой до её появления, первый же заход в админку падал с
 * `SQLITE_ERROR: no such table`. Заставлять владельца помнить про
 * `npm run db:migrate` после каждого обновления — плохая идея: схема должна
 * догонять код сама.
 *
 * Здесь ровно одна таблица и только `CREATE ... IF NOT EXISTS` / `ALTER TABLE
 * ADD COLUMN`: существующие данные не трогаются, повторный вызов бесплатный.
 * Ошибки не глотаем молча — они попадают в журнал, а вызывающий код решает,
 * показать пустой список или сообщение.
 */

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS \`studio_products\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`slug\` text NOT NULL,
    \`name\` text NOT NULL,
    \`tagline_ru\` text,
    \`tagline_en\` text,
    \`summary_ru\` text,
    \`summary_en\` text,
    \`version\` text,
    \`status_label\` text,
    \`repo_url\` text,
    \`changelog_path\` text DEFAULT 'CHANGELOG.md',
    \`download_url\` text,
    \`page_path\` text,
    \`background_url\` text,
    \`downloads\` text,
    \`facts\` text,
    \`is_published\` integer DEFAULT false NOT NULL,
    \`sort_order\` integer DEFAULT 0 NOT NULL,
    \`changelog_json\` text,
    \`changelog_synced_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  )`;

const CREATE_INDEXES = [
  "CREATE UNIQUE INDEX IF NOT EXISTS `studio_products_slug_idx` ON `studio_products` (`slug`)",
  "CREATE INDEX IF NOT EXISTS `studio_products_sort_order_idx` ON `studio_products` (`sort_order`)",
];

/** Колонки, добавленные после первого релиза таблицы. */
const LATE_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: "page_path", ddl: "ALTER TABLE `studio_products` ADD COLUMN `page_path` text" },
  { name: "downloads", ddl: "ALTER TABLE `studio_products` ADD COLUMN `downloads` text" },
  { name: "background_url", ddl: "ALTER TABLE `studio_products` ADD COLUMN `background_url` text" },
];

export class StudioSchemaError extends Error {}

let ensured: Promise<void> | null = null;

/**
 * Первый продукт на чистой базе.
 *
 * Line Launcher — flagship студии, и он же образец: продукт поставляется в
 * разобранном виде, поэтому архив кода есть сразу, до первого релиза. Запись
 * создаётся один раз: если владелец её удалит или переименует, она не вернётся.
 */
async function seedFirstProduct(): Promise<void> {
  const existing = await rows<{ id?: unknown }>("select id from `studio_products` limit 1");
  if (existing.length > 0) return;

  const product = PRODUCTS[0];
  if (!product) return;

  const downloads = sourceArchives("ilya-lavrov68/Line-Launcher", "heads/main");

  await run(
    `insert into \`studio_products\`
      (id, slug, name, tagline_ru, tagline_en, summary_ru, summary_en, version,
       status_label, repo_url, changelog_path, downloads, page_path, facts, is_published, sort_order)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "line-launcher",
      "line-launcher",
      product.name,
      product.tagline.ru,
      product.tagline.en,
      "Минималистичный Minecraft-лаунчер для игровых проектов: один провайдер — один лаунчер. Поставляется в разобранном виде — соберите под свой проект.",
      "A minimal Minecraft launcher for game projects: one provider, one launcher. Ships as source — build it for your own project.",
      product.badge ?? "",
      "В разработке",
      "https://github.com/ilya-lavrov68/Line-Launcher",
      "CHANGELOG.md",
      JSON.stringify(downloads),
      "/line-launcher",
      JSON.stringify([{ value: "Windows | Linux" }, { value: "Tauri 2.12 | Rust | React 19" }]),
      1,
      0,
    ],
  );
}

async function applySchema(): Promise<void> {
  await run(CREATE_TABLE);
  for (const statement of CREATE_INDEXES) await run(statement);

  const columns = await rows<{ name?: unknown }>("pragma table_info(`studio_products`)");
  const present = new Set(columns.map((column) => String(column.name ?? "")));
  for (const column of LATE_COLUMNS) {
    if (!present.has(column.name)) await run(column.ddl);
  }

  await seedFirstProduct();
}

/**
 * Гарантирует таблицу перед первым запросом. Одна попытка на процесс: если база
 * доступна только на чтение, каждый запрос не должен снова и снова биться в DDL.
 */
export function ensureStudioProductsSchema(): Promise<void> {
  if (!ensured) {
    ensured = applySchema().catch(async (error) => {
      ensured = null;
      // База только для чтения: таблицу создать нельзя, но и запросы тогда
      // бессмысленны — отдаём понятную ошибку вместо сырого SQLITE_ERROR.
      const message = error instanceof Error ? error.message : String(error);
      throw new StudioSchemaError(
        `Таблица продуктов студии недоступна: ${message}. Проверьте, что база открыта на запись, или выполните npm run db:migrate.`,
      );
    });
  }
  return ensured;
}

/** Диагностика для `db:check` и тестов: создана таблица или нет. */
export async function studioProductsTableExists(): Promise<boolean> {
  const found = await getDb().execute(
    "select name from sqlite_master where type = 'table' and name = 'studio_products'",
  );
  return found.rows.length > 0;
}
