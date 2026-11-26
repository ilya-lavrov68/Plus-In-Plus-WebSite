/**
 * Типы и форматирование истории версий Line Launcher.
 *
 * Модуль намеренно не трогает `node:fs`: его импортируют и серверная страница,
 * и клиентский фильтр. Чтение файла данных живёт в `lib/changelog.ts`.
 */

export type ChangelogSectionKind =
  | "added"
  | "changed"
  | "fixed"
  | "removed"
  | "security"
  | "note";

export interface ChangelogSection {
  kind: ChangelogSectionKind;
  title: string;
  /** Пункты списка; markdown внутри строки (`**жирный**`, `` `код` ``, ссылки). */
  items: string[];
  /** Абзацы без списка — пояснения автора релиза. */
  paragraphs: string[];
}

export interface ChangelogAsset {
  name: string;
  url: string;
  size: number;
  downloads: number;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  intro: string[];
  sections: ChangelogSection[];
  release: {
    tag: string | null;
    url: string | null;
    assets: ChangelogAsset[];
  };
}

export interface ChangelogData {
  repository: string;
  repositoryUrl: string;
  changelogPath: string;
  changelogUrl: string;
  tagsUrl: string;
  releasesUrl: string;
  defaultBranch: string;
  changelogSha: string;
  publishedReleaseCount: number;
  tagCount: number;
  latestVersion: string | null;
  latestDate: string | null;
  entries: ChangelogEntry[];
}

/** Якорь версии: `0.15.4` → `v0-15-4` (точки в id допустимы, но дефисы надёжнее). */
export function versionAnchor(version: string): string {
  return `v${version.replace(/\./g, "-")}`;
}

/** «17 ноября 2026» / “17 November 2026”. */
export function formatChangelogDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
