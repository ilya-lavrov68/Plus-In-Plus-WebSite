// Запуск TypeScript-скриптов в Node 24 native ESM (require() не поддерживает .ts).
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const rootDir = path.join(__dirname, "..");
if (!process.env.DATABASE_URL) {
  const { resolveDatabaseConfig } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ env: { ...process.env, NODE_ENV: "development" }, rootDir, allowDevelopmentFallback: true });
  if (config?.url) process.env.DATABASE_URL = config.url;
}
const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.cjs <script.ts> [args]");
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  "--experimental-transform-types",
  "--loader",
  pathToFileURL(path.join(__dirname, "lib", "ts-loader.mjs")).href,
  path.resolve(rootDir, target),
  ...process.argv.slice(3),
], { cwd: rootDir, env: process.env, stdio: "inherit" });
if (result.error) {
  console.error(`[run-ts] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
