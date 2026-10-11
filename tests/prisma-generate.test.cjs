const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");

const { createGenerateEnv } = require("../scripts/prisma-generate.cjs");

test("Prisma client generation can load config without TURSO_DATABASE_URL", () => {
  const env = createGenerateEnv({ PATH: "/usr/bin", TURSO_DATABASE_URL: "", CUSTOM_VALUE: "kept" });

  // Falls back to the local libSQL file so generation works on a fresh clone.
  assert.equal(env.TURSO_DATABASE_URL, `file:${path.join(__dirname, "..", "prisma", "dev.db")}`);
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.CUSTOM_VALUE, "kept");
});

test("Prisma generation preserves a configured Turso database", () => {
  const configuredUrl = "libsql://plus-in-plus-example.turso.io";
  const env = createGenerateEnv({ TURSO_DATABASE_URL: configuredUrl });

  assert.equal(env.TURSO_DATABASE_URL, configuredUrl);
});
