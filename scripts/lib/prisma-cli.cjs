// Small wrappers around the local Prisma CLI.
//
// Why the watchdog: `prisma db push` applies the schema in a few hundred
// milliseconds but then keeps its libSQL adapter connection open for ~60 s before
// the process exits (Prisma 6.19 + @prisma/adapter-libsql). Killing the CLI right
// after it printed the result — and verifying the database afterwards — keeps
// `npm run dev`/`npm run db:push` fast without trusting the exit code alone.
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const FINISHED_PATTERN = /(?:Your database is now in sync|The database is already in sync)/;

function cliAvailable() {
  return fs.existsSync(prismaCli);
}

/**
 * Runs `prisma db push --skip-generate` and stops the lingering CLI once it is done.
 *
 * `extraArgs` is appended verbatim, so a caller can reach the real Prisma flags —
 * e.g. `npm run db:push -- --accept-data-loss` for a destructive column change or
 * `npm run db:push -- --force-reset` for an empty database from scratch.
 */
function pushSchema({ env, useWatchdog = true, extraArgs = [] }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [prismaCli, "db", "push", "--skip-generate", ...extraArgs], {
      cwd: rootDir,
      env,
      stdio: useWatchdog ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let finished = false;
    let forcedKill;

    if (useWatchdog) {
      const watch = (stream, target) => {
        let tail = "";
        stream.on("data", (chunk) => {
          target.write(chunk);
          tail += chunk.toString();
          if (tail.length > 4000) tail = tail.slice(-4000);
          if (!finished && FINISHED_PATTERN.test(tail)) {
            finished = true;
            forcedKill = setTimeout(() => child.kill("SIGKILL"), 5000);
            child.kill("SIGTERM");
          }
        });
      };
      watch(child.stdout, process.stdout);
      watch(child.stderr, process.stderr);
    }

    child.on("error", (error) => {
      clearTimeout(forcedKill);
      resolve({ ok: false, finished, error });
    });

    child.on("close", (code, signal) => {
      clearTimeout(forcedKill);
      resolve({ ok: code === 0 || finished, finished, code, signal });
    });
  });
}

/** Regenerates lib/generated/prisma (reads the schema only, exits promptly). */
function generateClient({ env }) {
  const result = spawnSync(process.execPath, [prismaCli, "generate"], { cwd: rootDir, env, stdio: "inherit" });
  return result.status === 0;
}

module.exports = { cliAvailable, generateClient, prismaCli, pushSchema, rootDir };
