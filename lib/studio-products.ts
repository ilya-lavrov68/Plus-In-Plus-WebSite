import { randomUUID } from "node:crypto";

import { row, rows, run } from "@/lib/db";

/**
 * Продукты студии (Line Launcher и всё, что появится после него).
 *
 * Отличие от таблицы `products`: та — складской учёт товаров, эта — витрина
 * программных продуктов. Продукт описывается один раз здесь и публикуется
 * страницей-шаблоном `/products/[slug]`; история версий подтягивается из его
 * репозитория и хранится рядом, в `changelog_json`.
 */

export interface StudioProductFact {
  value: string;
}

export interface StudioProduct {
  id: string;
  slug: string;
  name: string;
  taglineRu: string;
  taglineEn: string;
  summaryRu: string;
  summaryEn: string;
  version: string;
  statusLabel: string;
  repoUrl: string;
  changelogPath: string;
  downloadUrl: string;
  /** Свой адрес страницы; пусто — шаблон `/products/[slug]`. */
  pagePath: string;
  facts: StudioProductFact[];
  published: boolean;
  sortOrder: number;
  changelogSyncedAt: string | null;
  /** Разобранная история версий; null — ещё не синхронизировали. */
  changelog: unknown | null;
}

export interface StudioProductInput {
  slug: string;
  name: string;
  taglineRu: string;
  taglineEn: string;
  summaryRu: string;
  summaryEn: string;
  version: string;
  statusLabel: string;
  repoUrl: string;
  changelogPath: string;
  downloadUrl: string;
  pagePath: string;
  facts: string[];
  published: boolean;
  sortOrder: number;
}

const SELECT_COLUMNS = `id, slug, name, tagline_ru, tagline_en, summary_ru, summary_en,
  version, status_label, repo_url, changelog_path, download_url, page_path, facts,
  is_published, sort_order, changelog_json, changelog_synced_at`;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseFacts(value: unknown): StudioProductFact[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "string" ? item : (item as { value?: unknown })?.value))
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((value_) => ({ value: value_.trim() }));
  } catch {
    return [];
  }
}

function mapProduct(record: Record<string, unknown>): StudioProduct {
  return {
    id: text(record.id),
    slug: text(record.slug),
    name: text(record.name),
    taglineRu: text(record.tagline_ru),
    taglineEn: text(record.tagline_en),
    summaryRu: text(record.summary_ru),
    summaryEn: text(record.summary_en),
    version: text(record.version),
    statusLabel: text(record.status_label),
    repoUrl: text(record.repo_url),
    changelogPath: text(record.changelog_path) || "CHANGELOG.md",
    downloadUrl: text(record.download_url),
    pagePath: text(record.page_path),
    facts: parseFacts(record.facts),
    published: Number(record.is_published) === 1,
    sortOrder: Number(record.sort_order) || 0,
    changelogSyncedAt: record.changelog_synced_at ? text(record.changelog_synced_at) : null,
    changelog: record.changelog_json ? safeJson(record.changelog_json) : null,
  };
}

function safeJson(value: unknown): unknown | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Все продукты — для админки. */
export async function listStudioProducts(): Promise<StudioProduct[]> {
  const records = await rows<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from studio_products order by sort_order asc, name asc`,
  );
  return records.map(mapProduct);
}

/** Только опубликованные — для сайта и меню в шапке. */
export async function listPublishedStudioProducts(): Promise<StudioProduct[]> {
  const records = await rows<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from studio_products where is_published = 1 order by sort_order asc, name asc`,
  );
  return records.map(mapProduct);
}

export async function getStudioProductBySlug(slug: string): Promise<StudioProduct | null> {
  const record = await row<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from studio_products where slug = ? limit 1`,
    [slug],
  );
  return record ? mapProduct(record) : null;
}

export async function getStudioProductById(id: string): Promise<StudioProduct | null> {
  const record = await row<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from studio_products where id = ? limit 1`,
    [id],
  );
  return record ? mapProduct(record) : null;
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function studioProductValues(input: StudioProductInput) {
  return [
    normalizeSlug(input.slug),
    input.name.trim(),
    input.taglineRu.trim(),
    input.taglineEn.trim(),
    input.summaryRu.trim(),
    input.summaryEn.trim(),
    input.version.trim(),
    input.statusLabel.trim(),
    input.repoUrl.trim(),
    input.changelogPath.trim() || "CHANGELOG.md",
    input.downloadUrl.trim(),
    input.pagePath.trim(),
    JSON.stringify(input.facts.filter(Boolean).map((value) => ({ value }))),
    input.published ? 1 : 0,
    Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
  ];
}

export async function createStudioProduct(input: StudioProductInput): Promise<string> {
  const id = randomUUID();
  await run(
    `insert into studio_products
      (id, slug, name, tagline_ru, tagline_en, summary_ru, summary_en, version,
       status_label, repo_url, changelog_path, download_url, page_path, facts, is_published, sort_order)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ...studioProductValues(input)],
  );
  return id;
}

export async function updateStudioProduct(id: string, input: StudioProductInput): Promise<void> {
  await run(
    `update studio_products set
      slug = ?, name = ?, tagline_ru = ?, tagline_en = ?, summary_ru = ?, summary_en = ?,
      version = ?, status_label = ?, repo_url = ?, changelog_path = ?, download_url = ?,
      page_path = ?, facts = ?, is_published = ?, sort_order = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     where id = ?`,
    [...studioProductValues(input), id],
  );
}

export async function setStudioProductPublished(id: string, published: boolean): Promise<void> {
  await run(
    `update studio_products
       set is_published = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     where id = ?`,
    [published ? 1 : 0, id],
  );
}

export async function saveStudioProductChangelog(
  id: string,
  changelog: unknown,
): Promise<void> {
  await run(
    `update studio_products
       set changelog_json = ?, changelog_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     where id = ?`,
    [JSON.stringify(changelog), id],
  );
}

/** Адрес страницы продукта: свой, если задан, иначе шаблон. */
export function studioProductPath(product: StudioProduct): string {
  const custom = product.pagePath.trim();
  if (!custom) return `/products/${product.slug}`;
  return custom.startsWith("/") ? custom : `/${custom}`;
}

export async function deleteStudioProduct(id: string): Promise<void> {
  await run("delete from studio_products where id = ?", [id]);
}
