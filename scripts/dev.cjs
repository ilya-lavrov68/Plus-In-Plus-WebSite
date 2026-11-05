// Запуск Next.js после проверки зависимостей и read-only диагностики Payload БД.
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");
const { checkDependencies, formatReport, needsInstall, npmCommand } = require("./lib/dependency-check.cjs");

const rootDir = path.join(__dirname, "..");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function runNpmInstall() {
  console.log("[dev] Running npm install to repair the install…");
  const install = spawnSync(npmCommand(), ["install", "--no-audit", "--no-fund"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return install.status === 0;
}

/**
 * `next build` и `next dev` делят каталог `.next`. Если dev стартует поверх
 * прод-артефактов (`.next/BUILD_ID`), Turbopack падает с «An unexpected
 * Turbopack error occurred», а браузер получает битые чанки. Поэтому перед
 * запуском dev прод-кэш удаляется — dev собирает собственный.
 */
function resetProductionBuildCache() {
  const nextDir = path.join(rootDir, ".next");
  if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) return;
  if (process.env.PIP_KEEP_BUILD_CACHE === "1") {
    console.warn("[dev] .next holds a production build; Turbopack may fail. Delete .next or unset PIP_KEEP_BUILD_CACHE.");
    return;
  }
  console.log("[dev] Production build found in .next — removing it before dev starts.");
  fs.rmSync(nextDir, { recursive: true, force: true });
}

/**
 * Жёстко завершённый dev-процесс (SIGKILL, падение контейнера) оставляет в
 * `.next/dev` Turbopack-кэш и lock-файл. Следующий запуск поднимает сервер с
 * повреждённым кэшем и отдаёт на отдельных страницах «An unexpected Turbopack
 * error occurred». Поэтому устаревший dev-кэш удаляется: живой сервер узнаётся
 * по pid из lock-файла. Принудительная очистка — PIP_FRESH_DEV_CACHE=1.
 */
function resetStaleDevCache() {
  const devDir = path.join(rootDir, ".next", "dev");
  if (!fs.existsSync(devDir)) return;

  if (process.env.PIP_FRESH_DEV_CACHE === "1") {
    console.log("[dev] PIP_FRESH_DEV_CACHE=1 — clearing .next/dev.");
    fs.rmSync(devDir, { recursive: true, force: true });
    return;
  }

  const lockPath = path.join(devDir, "lock");
  if (!fs.existsSync(lockPath)) return;

  let pid = null;
  try {
    pid = JSON.parse(fs.readFileSync(lockPath, "utf8")).pid;
  } catch {
    pid = null;
  }

  const alive = typeof pid === "number" && pid > 0 ? isProcessAlive(pid) : false;
  if (alive) {
    console.warn("[dev] Another dev server looks alive (lock pid " + pid + "); keeping .next/dev.");
    return;
  }
  console.log("[dev] Stale dev cache found — clearing .next/dev before start.");
  fs.rmSync(devDir, { recursive: true, force: true });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function ensureInstall() {
  const autoInstall = process.env.PIP_NO_AUTO_INSTALL !== "1";
  let result = checkDependencies();
  let report = formatReport(result);
  if (report.length === 0 && fs.existsSync(nextBin)) return;
  for (const line of report) console.warn(line);
  if (!autoInstall || !needsInstall(result)) {
    if (!fs.existsSync(nextBin)) {
      console.error("[dev] Next.js is not installed — run npm install first.");
      process.exit(1);
    }
    return;
  }
  if (!runNpmInstall()) console.warn("[dev] npm install reported an error.");
  result = checkDependencies();
  report = formatReport(result);
  for (const line of report) console.warn(line);
  if (!fs.existsSync(nextBin)) process.exit(1);
}

async function main() {
  ensureInstall();
  resetProductionBuildCache();
  resetStaleDevCache();
  const env = { ...process.env };
  try {
    const { resolveDatabaseConfig, describeDatabaseUrl, unsupportedDatabaseUrlMessage } = loadDatabaseModule();
    const warning = unsupportedDatabaseUrlMessage();
    if (warning) console.warn(`[dev] ${warning}`);
    const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
    if (config) {
      env.DATABASE_URL = config.url;
      console.log(`[dev] Database: ${describeDatabaseUrl(config.url)} (${config.remote ? "remote libSQL" : "local file"})`);
      try {
        const status = await checkSchema(config);
        if (status.ok) console.log("[dev] Schema is up to date.");
        else console.warn(`[dev] Missing tables: ${status.missingTables.join(", ")}. Run npm run db:migrate before using the admin panel.`);
      } catch (error) {
        console.warn(`[dev] Database check failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`[dev] ${error.message}`);
  }

  const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
    cwd: rootDir,
    stdio: "inherit",
    env,
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code, signal) => process.exit(signal ? 0 : code ?? 0));
}

main().catch((error) => {
  console.error(`[dev] ${error.message}`);
  process.exit(1);
});
