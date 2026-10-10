// Generates the Prisma client (lib/generated/prisma) after `npm install`.
//
// The generated client is gitignored, so every fresh checkout needs
// `prisma generate` before `next build` can resolve `@/lib/generated/prisma/client`.
// Running it from postinstall keeps local dev, CI and Vercel builds working
// without a manual step.
//
// Offline fallback: if `prisma generate` fails (e.g. no network access to
// binaries.prisma.sh) but a previously generated client already exists, keep it
// and only warn instead of failing the whole `npm install`. If there is no
// generated client at all, fail loudly — the build cannot succeed without it.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const generatedClientEntry = path.join(rootDir, "lib", "generated", "prisma", "client.ts");

if (!fs.existsSync(prismaCli)) {
  console.log("[postinstall] Prisma CLI not installed — skipping client generation.");
  process.exit(0);
}

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: rootDir,
  stdio: "inherit",
});

if (result.status === 0) {
  process.exit(0);
}

if (result.error) {
  console.error(`[postinstall] Failed to run prisma generate: ${result.error.message}`);
} else {
  console.error(`[postinstall] prisma generate exited with code ${result.status}.`);
}

if (fs.existsSync(generatedClientEntry)) {
  console.warn(
    "[postinstall] Keeping the existing lib/generated/prisma client " +
      "(offline environment?). Re-run `npx prisma generate` once you are online.",
  );
  process.exit(0);
}

console.error(
  "[postinstall] No generated Prisma client found at lib/generated/prisma — " +
    "the Next.js build cannot resolve @/lib/generated/prisma/client.",
);
process.exit(1);
