// `npm run dev` — start Next.js with a guaranteed, up-to-date database schema.
//
// The schema is checked (and only then synchronized) before the dev server starts,
// so a fresh clone or a schema change never produces "table does not exist".
// A failing sync is reported loudly but does not block the server: the public
// pages render empty states without a database.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");
const { checkDependencies, formatReport } = require("./lib/dependency-check.cjs");
const { cliAvailable, generateClient, pushSchema, rootDir } = require("./lib/prisma-cli.cjs");

const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

// A stale install is the most common reason a dev server renders nothing but 500s, so it is
// reported before anything else starts.
function checkInstall() {
  if (!fs.existsSync(nextBin)) {
    console.error("[dev] Next.js is not installed — run `npm install` first.");
    process.exit(1);
  }

  const report = formatReport(checkDependencies());
  if (report.length === 0) return;

  for (const line of report) console.warn(line);
  console.warn("");
}

async function syncSchema(config, env) {
  if (!cliAvailable()) {
    console.warn("[dev] Prisma CLI is not installed — skipping `prisma db push`. Run `npm install`.");
    return;
  }

  let status;
  try {
    status = await checkSchema({ url: config.url, authToken: config.authToken, schemaPath: undefined });
  } catch (error) {
    console.warn(`[dev] Could not inspect the database: ${error.message}`);
    status = { ok: false };
  }

  if (status.ok) {
    console.log("[dev] Schema is up to date.");
    return;
  }

  console.log(
    "[dev] Schema changes detected" +
      (status.missingTables?.length ? ` (missing: ${[...status.missingTables, ...(status.missingColumns ?? [])].join(", ")})` : "") +
      " — running `prisma db push`…",
  );

  const push = await pushSchema({ env });
  const after = push.ok
    ? await checkSchema({ url: config.url, authToken: config.authToken, schemaPath: undefined }).catch(() => ({ ok: false }))
    : { ok: false };

  if (!push.ok || !after.ok) {
    console.warn(
      "\n[dev] WARNING: the database schema could not be synchronized.\n" +
        "[dev] Tables may be missing, so sign-in and admin pages will fail until you run:\n" +
        "[dev]   npm run db:push\n",
    );
    return;
  }

  console.log("[dev] Schema is up to date.");
  generateClient({ env });
}

function main() {
  checkInstall();

  const env = { ...process.env };
  let config = null;

  try {
    const { resolveDatabaseConfig, describeDatabaseUrl, unsupportedDatabaseUrlMessage } = loadDatabaseModule();
    const message = unsupportedDatabaseUrlMessage();
    if (message) console.warn(`[dev] ${message}`);
    config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
    if (config) {
      env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL?.trim() || config.url;
      console.log(`[dev] Database: ${describeDatabaseUrl(config.url)} (${config.remote ? "Turso/libSQL" : "local file"})`);
    }
  } catch (error) {
    console.warn(`[dev] ${error.message}`);
  }

  const start = async () => {
    if (config) await syncSchema(config, env);

    const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
      cwd: rootDir,
      stdio: "inherit",
      env,
    });

    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => child.kill(signal));
    }
    child.on("exit", (code, signal) => {
      process.exit(signal ? 0 : code ?? 0);
    });
  };

  start().catch((error) => {
    console.error(`[dev] ${error.message}`);
    process.exit(1);
  });
}

main();
