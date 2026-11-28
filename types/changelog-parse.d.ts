/**
 * Типы для парсера истории версий из `scripts/lib/changelog-parse.mjs`.
 *
 * Один и тот же разбор используют и `npm run changelog:sync` (Node-скрипт), и
 * кнопка «Синхронизировать» в админке. Дублировать 270 строк ради TypeScript
 * смысла нет, поэтому модуль объявляется здесь.
 */
declare module "@/scripts/lib/changelog-parse.mjs" {
  import type { ChangelogEntry } from "@/lib/changelog-format";

  export interface GithubTag {
    name: string;
    commit?: { sha?: string };
  }
  export interface GithubRelease {
    tag_name?: string;
    name?: string | null;
    html_url?: string;
    published_at?: string | null;
    body?: string | null;
    assets?: Array<{
      name: string;
      browser_download_url: string;
      size: number;
      download_count?: number;
    }>;
  }

  export function parseChangelog(markdown: string): {
    entries: ChangelogEntry[];
    skipped: string[];
  };
  export function compareVersions(a: string, b: string): number;
  export function applyGitHubData(
    entries: ChangelogEntry[],
    tags: GithubTag[],
    releases: GithubRelease[],
  ): ChangelogEntry[];
}
