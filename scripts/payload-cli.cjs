// Payload CLI с теми же native TypeScript/path-alias hooks, что и run-ts.cjs.
// Без этого `--disable-transpile` не разрешает импорты `@/...` в payload.config.ts.
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const rootDir = path.join(__dirname, "..");
// CLI commands must exit cleanly even when a Next dev server is running.
process.env.DISABLE_PAYLOAD_HMR = "true";
if (!process.env.PAYLOAD_DATABASE_URL) {
  const { resolveDatabaseConfig } = loadDatabaseModule();
  const config = resolveDatabaseConfig({
    env: { ...process.env, NODE_ENV: "development" },
    rootDir,
    allowDevelopmentFallback: true,
  });
  if (config?.url) process.env.PAYLOAD_DATABASE_URL = config.url;
}

const result = spawnSync(process.execPath, [
  "--experimental-transform-types",
  "--loader",
  path.join(__dirname, "lib", "ts-loader.mjs"),
  path.join(rootDir, "node_modules", "payload", "bin.js"),
  "--disable-transpile",
  ...process.argv.slice(2),
], { cwd: rootDir, env: process.env, stdio: "inherit" });

if (result.error) {
  console.error(`[payload] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
