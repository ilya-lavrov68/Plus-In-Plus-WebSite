// `npm run dev` — start Next.js with a guaranteed, up-to-date database schema.
//
// The schema is checked (and only then synchronized) before the dev server starts,
// so a fresh clone or a schema change never produces "table does not exist".
// A failing sync is reported loudly but does not block the server: the public
// pages render empty states without a database.
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");
const {
  checkDependencies,
  formatReport,
  needsInstall,
  npmCommand,
} = require("./lib/dependency-check.cjs");
const {
  applyOfflineSqliteDdl,
  cliAvailable,
  generateClient,
  pushSchema,
  rootDir,
} = require("./lib/prisma-cli.cjs");

const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function runNpmInstall() {
  console.log("[dev] Running `npm install` to repair the install…");
  const install = spawnSync(npmCommand(), ["install", "--no-audit", "--no-fund"], {
    cwd: rootDir,
    stdio: "inherit",
    // Node refuses to spawn .cmd files without a shell (EINVAL) since the 2024 CVE fix.
    shell: process.platform === "win32",
  });
  return install.status === 0;
}

/**
 * A stale install is the most common reason a dev server renders nothing but 500s with
 * `Module not found`, so it is diagnosed — and repaired — before Next.js starts. Set
 * PIP_NO_AUTO_INSTALL=1 to only get the report.
 */
function ensureInstall() {
  const autoInstall = process.env.PIP_NO_AUTO_INSTALL !== "1";
  let result = checkDependencies();
  let report = formatReport(result);

  if (report.length === 0 && fs.existsSync(nextBin)) return;
  for (const line of report) console.warn(line);

  if (!autoInstall || !needsInstall(result)) {
    if (!fs.existsSync(nextBin)) {
      console.error("[dev] Next.js is not installed — run `npm install` first.");
      process.exit(1);
    }
    if (report.length > 0) console.warn("");
    return;
  }

  const installed = runNpmInstall();
  if (!installed) console.warn("[dev] `npm install` reported an error — see the output above.");

  result = checkDependencies();
  report = formatReport(result);

  if (report.length === 0 && fs.existsSync(nextBin)) {
    console.log("[dev] Dependencies are complete.");
    return;
  }

  console.warn("");
  for (const line of report) console.warn(line);
  if (!fs.existsSync(nextBin)) {
    console.error("[dev] Next.js is still not installed — fix the errors above, then run `npm install`.");
    process.exit(1);
  }
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

  // A local development database can be brought up to date with additive DDL
  // alone. This avoids sending Prisma's destructive-change warnings through a
  // routine `npm run dev` when only a nullable column or an index is missing.
  if (!config.remote) {
    console.log("[dev] Applying additive local schema updates…");
    try {
      await applyOfflineSqliteDdl(env);
      const localStatus = await checkSchema({
        url: config.url,
        authToken: config.authToken,
        schemaPath: undefined,
      });
      if (localStatus.ok) {
        generateClient({ env });
        console.log("[dev] Schema is up to date.");
        return;
      }
    } catch (error) {
      // Fall through to Prisma for a complete diagnostic. In particular, a
      // duplicate unique value remains an explicit error, never an auto-reset.
      console.warn(`[dev] Additive local update needs Prisma review: ${error.message}`);
    }
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
  ensureInstall();

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
