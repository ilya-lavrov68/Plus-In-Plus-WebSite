// Generates the Prisma client (lib/generated/prisma) after `npm install`.
//
// The generated client is gitignored, so every fresh checkout needs
// `prisma generate` before `next build` can resolve `@/lib/generated/prisma/client`.
// Running it from postinstall keeps local dev, CI and Vercel builds working
// without a manual step. Prisma generation only reads the schema; it does not
// connect to the database, so it must also work before .env is configured.
//
// Offline fallback: if `prisma generate` fails (e.g. no network access to
// binaries.prisma.sh) but a previously generated client already exists, keep it
// and only warn instead of failing the whole `npm install`. If there is no
// generated client at all, fail loudly — the build cannot succeed without it.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// prisma.config.ts reads TURSO_DATABASE_URL and connects through the libSQL driver
// adapter. Generation never opens that connection, so a local file path is enough
// to satisfy the schema's `env("TURSO_DATABASE_URL")` on a fresh clone.
const DEFAULT_TURSO_DATABASE_URL = `file:${path.join(__dirname, "..", "prisma", "dev.db")}`;

function createGenerateEnv(sourceEnv = process.env) {
  const generateEnv = { ...sourceEnv };

  // prisma.config.ts uses env("TURSO_DATABASE_URL"), which otherwise makes `prisma
  // generate` fail on a fresh clone before the user has copied .env.example. The URL
  // is only used to satisfy config loading; generate never opens a DB connection.
  if (!generateEnv.TURSO_DATABASE_URL?.trim()) {
    generateEnv.TURSO_DATABASE_URL = DEFAULT_TURSO_DATABASE_URL;
  }

  return generateEnv;
}

function generatePrismaClient() {
  const rootDir = path.join(__dirname, "..");
  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
  const generatedClientEntry = path.join(rootDir, "lib", "generated", "prisma", "client.ts");

  if (!fs.existsSync(prismaCli)) {
    console.log("[postinstall] Prisma CLI not installed — skipping client generation.");
    return 0;
  }

  const result = spawnSync(process.execPath, [prismaCli, "generate", "--no-engine"], {
    cwd: rootDir,
    stdio: "inherit",
    env: createGenerateEnv(),
  });

  if (result.status === 0) {
    const generatedClassFile = path.join(rootDir, "lib", "generated", "prisma", "internal", "class.ts");
    if (fs.existsSync(generatedClassFile)) {
      const content = fs.readFileSync(generatedClassFile, "utf8");
      if (content.includes('"copyEngine": false')) {
        fs.writeFileSync(generatedClassFile, content.replace('"copyEngine": false', '"copyEngine": true'));
      }
    }
    return 0;
  }

  if (result.error) {
    console.error(`[postinstall] Failed to run prisma generate: ${result.error.message}`);
  } else {
    console.error(`[postinstall] prisma generate exited with code ${result.status}.`);
  }

  if (fs.existsSync(generatedClientEntry)) {
    console.warn(
      "[postinstall] Keeping the existing lib/generated/prisma client " +
        "(offline environment?). Re-run `npm run prisma:generate` once you are online.",
    );
    return 0;
  }

  console.error(
    "[postinstall] No generated Prisma client found at lib/generated/prisma — " +
      "the Next.js build cannot resolve @/lib/generated/prisma/client.",
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = generatePrismaClient();
}

module.exports = { createGenerateEnv };
