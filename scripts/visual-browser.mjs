// Chromium для скриншотов: поиск, восстановление и запуск.
//
// Адаптировано из Line Launcher (`scripts/restore-browser.mjs`). Идея та же:
// в песочницах без системных библиотек и без доступа к CDN Playwright браузер
// берётся из npm-реестра — пакет `@sparticuz/chromium` везёт с собой бинарь
// Chromium и набор AL2023-библиотек. Библиотеки распаковываются в кэш и
// подключаются через LD_LIBRARY_PATH только для процесса съёмки.
//
// Порядок:
//   1. CHROMIUM_PATH или установленный Chrome/Chromium/Edge;
//   2. кэш ~/.cache/pip-site/browser с @sparticuz/chromium;
//   3. установка @sparticuz/chromium из npm-реестра (Linux x64).
//
// Кэш живёт вне репозитория: 75 МБ бинарей не должны попадать в Git.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { browserHelp, findBrowser } from "./lib/find-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_VERSION = "158";

export function cacheRoot(env = process.env) {
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "pip-site", "browser");
}

function run(file, args, env = process.env, timeout = 20_000) {
  return spawnSync(file, args, {
    cwd: root,
    encoding: "utf8",
    env,
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
}

export function versionOf(file, env = process.env) {
  if (!file || !existsSync(file)) return undefined;
  const result = run(file, ["--version"], env);
  if (result.error || result.status !== 0) return undefined;
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(
    /(?:Chromium|Chrome|HeadlessChrome|Microsoft Edge)[^\d]*(\d+\.\d+(?:\.\d+)?)/i,
  )?.[1];
}

function packageDir(env = process.env) {
  return path.join(cacheRoot(env), "node_modules", "@sparticuz", "chromium");
}

async function loadNpmChromium(env = process.env) {
  const dir = packageDir(env);
  const packageJson = path.join(dir, "package.json");
  if (!existsSync(packageJson)) return undefined;

  const chromium = (await import(pathToFileURL(path.join(dir, "build", "index.js")).href)).default;
  const { inflate } = await import(pathToFileURL(path.join(dir, "build", "lambdafs.js")).href);

  const executable = await chromium.executablePath();
  // Сборка рассчитана на Amazon Linux: свои NSS/GTK-библиотеки подключаем
  // только этому процессу, не трогая окружение пользователя.
  const libraries = await inflate(path.join(dir, "bin", "al2023.tar.br"));
  const launchEnv = {
    ...env,
    LD_LIBRARY_PATH: [path.join(libraries, "lib"), env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(path.delimiter),
  };

  const version = versionOf(executable, launchEnv);
  if (!version) return undefined;

  return {
    path: executable,
    version,
    source: `npm registry @sparticuz/chromium ${readVersion(packageJson)}`,
    env: launchEnv,
    args: chromium.args,
  };
}

function readVersion(packageJson) {
  try {
    return JSON.parse(readFileSync(packageJson, "utf8")).version;
  } catch {
    return CACHE_VERSION;
  }
}

function installNpmChromium(env = process.env) {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("Фолбэк из npm-реестра доступен только на Linux x64.");
  }
  mkdirSync(cacheRoot(env), { recursive: true });
  console.log(`[browser] Ставлю @sparticuz/chromium@${CACHE_VERSION} из npm-реестра…`);
  const result = run(
    "npm",
    [
      "install",
      "--prefix",
      cacheRoot(env),
      "--no-save",
      "--no-package-lock",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `@sparticuz/chromium@${CACHE_VERSION}`,
    ],
    env,
    20 * 60 * 1000,
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm install завершился с кодом ${result.status}.`);
}

/** Возвращает рабочий браузер: путь, версию, окружение и флаги запуска. */
export async function resolveBrowser(env = process.env) {
  const candidates = [];
  if (env.CHROMIUM_PATH) candidates.push({ path: env.CHROMIUM_PATH, source: "CHROMIUM_PATH" });

  const system = findBrowser({ ...env, CHROMIUM_PATH: "" });
  if (system) candidates.push({ path: system.path, source: system.via });

  for (const candidate of candidates) {
    const version = versionOf(candidate.path, env);
    if (version) {
      return { ...candidate, version, env: { ...env }, args: [] };
    }
  }

  const cached = await loadNpmChromium(env);
  if (cached) return cached;

  installNpmChromium(env);
  const installed = await loadNpmChromium(env);
  if (!installed) throw new Error("Пакет не содержит рабочего бинаря Chromium.");
  return installed;
}

/** CLI: `npm run browser:restore` — проверка и печать пути. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const browser = await resolveBrowser();
    console.log(`[browser] Chromium готов: ${browser.path} (${browser.version}; ${browser.source})`);
  } catch (error) {
    console.error(`[browser] ${error.message}`);
    console.error(browserHelp());
    process.exitCode = 1;
  }
}
