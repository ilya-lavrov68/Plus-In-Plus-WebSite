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
