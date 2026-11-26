// Синхронизация истории версий Line Launcher с GitHub.
//
//   npm run changelog:sync          # обновить data/line-launcher-changelog.json
//   npm run changelog:sync -- --check   # только проверить, что файл актуален
//
// Источник — репозиторий ilya-lavrov68/Line-Launcher: CHANGELOG.md, теги и
// релизы. Ничего не дописываем: если в репозитории нет релиза или тега, на
// сайте их тоже не будет.
//
// Токен не обязателен: публичный API отдаёт 60 запросов в час на IP, а скрипт
// делает четыре. Если задан GITHUB_TOKEN, лимит выше — токен читается только
// из окружения и никогда не попадает в файл данных.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyGitHubData, compareVersions, parseChangelog } from "./lib/changelog-parse.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "content", "line-launcher-changelog.json");

const REPOSITORY = "ilya-lavrov68/Line-Launcher";
const API = `https://api.github.com/repos/${REPOSITORY}`;
const changelogPath = "CHANGELOG.md";

const checkOnly = process.argv.includes("--check");

async function github(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "plus-in-plus-website-changelog-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

async function main() {
  const [repo, tags, releases, file] = await Promise.all([
    github(API),
    github(`${API}/tags?per_page=100`),
    github(`${API}/releases?per_page=100`),
    github(`${API}/contents/${changelogPath}?ref=${encodeURIComponent("main")}`),
  ]);

  const markdown = Buffer.from(file.content, file.encoding ?? "base64").toString("utf8");
  const { entries, skipped } = parseChangelog(markdown);
  if (entries.length === 0) {
    throw new Error("в CHANGELOG.md не найдено ни одной версии вида «## 0.15.4 — 2026-11-17»");
  }

  const sorted = [...entries].sort((a, b) => compareVersions(a.version, b.version));
  const withGitHub = applyGitHubData(sorted, tags, releases);

  const payload = {
    repository: REPOSITORY,
    repositoryUrl: `https://github.com/${REPOSITORY}`,
    changelogPath,
    changelogUrl: `https://github.com/${REPOSITORY}/blob/${repo.default_branch}/${changelogPath}`,
    tagsUrl: `https://github.com/${REPOSITORY}/tags`,
    releasesUrl: `https://github.com/${REPOSITORY}/releases`,
    defaultBranch: repo.default_branch,
    changelogSha: file.sha,
    changelogHash: createHash("sha256").update(markdown).digest("hex"),
    publishedReleaseCount: releases.length,
    tagCount: tags.length,
    latestVersion: withGitHub[0]?.version ?? null,
    latestDate: withGitHub[0]?.date ?? null,
    /** Разделы файла, не похожие на релиз (методичка о версиях). */
    skippedHeadings: skipped,
    entries: withGitHub,
  };

  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== next) {
      console.error(
        "[changelog] content/line-launcher-changelog.json устарел — запустите `npm run changelog:sync`",
      );
      process.exitCode = 1;
      return;
    }
    console.log("[changelog] файл данных совпадает с GitHub");
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, next, "utf8");
  console.log(
    `[changelog] ${withGitHub.length} версий (последняя ${payload.latestVersion}), ` +
      `релизов на GitHub: ${releases.length}, тегов: ${tags.length} → ${path.relative(root, outputPath)}`,
  );
}

await main();
