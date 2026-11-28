import {
  applyGitHubData,
  compareVersions,
  parseChangelog,
  type GithubRelease,
  type GithubTag,
} from "@/scripts/lib/changelog-parse.mjs";
import type { ChangelogData } from "@/lib/changelog-format";
import { buildsFromReleases, type StudioBuild } from "@/lib/studio-builds";

export type { StudioBuild };

/**
 * Подтягивание истории версий продукта из его репозитория на GitHub.
 *
 * Тот же принцип, что у `npm run changelog:sync` для Line Launcher: факты
 * беруттся только из репозитория — `CHANGELOG.md`, теги и релизы. Ничего не
 * придумывается и не дописывается руками: если релиза нет в GitHub, его не
 * будет и на сайте.
 *
 * Запросов ровно четыре на продукт (репозиторий, теги, релизы, файл), поэтому
 * публичного лимита GitHub хватает и без токена. Если `GITHUB_TOKEN` задан в
 * окружении, лимит выше; токен нигде не сохраняется.
 */

export interface StudioChangelogResult {
  data: ChangelogData;
  entriesCount: number;
  /** Сборки последнего релиза: платформа, формат и ссылка на файл. */
  downloads: StudioBuild[];
}

export class StudioSyncError extends Error {}

const API_ROOT = "https://api.github.com";

function repositoryFromUrl(repoUrl: string): string | null {
  const trimmed = repoUrl.trim();
  if (!trimmed) return null;

  // Принимаем и полный адрес, и короткую запись «владелец/репозиторий».
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i,
  );
  if (match) return `${match[1]}/${match[2].replace(/\.git$/, "")}`;

  const short = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  return short ? `${short[1]}/${short[2]}` : null;
}

async function github<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "plus-in-plus-studio-products",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new StudioSyncError(
      `GitHub ответил ${response.status} ${response.statusText}. Проверьте ссылку на репозиторий и его публичность.`,
    );
  }
  return (await response.json()) as T;
}

interface RepoMeta {
  full_name: string;
  default_branch: string;
  html_url: string;
}

interface ContentsPayload {
  content: string;
  encoding?: string;
  sha: string;
  html_url?: string;
}

/**
 * Читает историю версий продукта. Ошибки возвращаются текстом: админка
 * показывает их в форме, а не молча оставляет пустую таблицу.
 */
export async function fetchStudioChangelog(options: {
  repoUrl: string;
  changelogPath?: string;
}): Promise<StudioChangelogResult> {
  const repository = repositoryFromUrl(options.repoUrl);
  if (!repository) {
    throw new StudioSyncError(
      "Нужна ссылка вида https://github.com/владелец/репозиторий или владелец/репозиторий.",
    );
  }

  const changelogPath = options.changelogPath?.trim() || "CHANGELOG.md";
  const api = `${API_ROOT}/repos/${repository}`;

  const [repo, tags, releases] = await Promise.all([
    github<RepoMeta>(api),
    github<GithubTag[]>(`${api}/tags?per_page=100`),
    github<GithubRelease[]>(`${api}/releases?per_page=100`),
  ]);

  const file = await github<ContentsPayload>(
    `${api}/contents/${encodeURIComponent(changelogPath)}?ref=${encodeURIComponent(repo.default_branch)}`,
  );
  const markdown = Buffer.from(file.content, file.encoding === "base64" ? "base64" : "utf8").toString("utf8");

  const { entries } = parseChangelog(markdown);
  if (entries.length === 0) {
    throw new StudioSyncError(
      `В ${changelogPath} не нашлось ни одной версии вида «## 1.0.0 — 2026-01-31».`,
    );
  }

  const sorted = [...entries].sort((a, b) => compareVersions(a.version, b.version));
  const enriched = applyGitHubData(sorted, tags, releases);

  const latest = enriched[enriched.length - 1] ?? null;
  const data: ChangelogData = {
    repository: repo.full_name,
    repositoryUrl: repo.html_url,
    changelogPath,
    changelogUrl: `${repo.html_url}/blob/${repo.default_branch}/${changelogPath}`,
    tagsUrl: `${repo.html_url}/tags`,
    releasesUrl: `${repo.html_url}/releases`,
    defaultBranch: repo.default_branch,
    changelogSha: file.sha,
    publishedReleaseCount: enriched.filter((entry) => entry.release.tag).length,
    tagCount: tags.length,
    latestVersion: latest?.version ?? null,
    latestDate: latest?.date ?? null,
    entries: enriched,
  };

  return {
    data,
    entriesCount: enriched.length,
    downloads: buildsFromReleases(releases, data.latestVersion),
  };
}
