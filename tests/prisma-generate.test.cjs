const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createGenerateEnv } = require("../scripts/prisma-generate.cjs");

test("Prisma client generation can load config without DATABASE_URL", () => {
  const env = createGenerateEnv({ PATH: "/usr/bin", DATABASE_URL: "", CUSTOM_VALUE: "kept" });

  assert.equal(
    env.DATABASE_URL,
    "postgresql://postgres:postgres@localhost:5432/plus_in_plus?schema=public",
  );
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.CUSTOM_VALUE, "kept");
});

test("Prisma generation preserves a configured DATABASE_URL", () => {
  const configuredUrl = "postgresql://app:secret@db.example:5432/site?schema=public";
  const env = createGenerateEnv({ DATABASE_URL: configuredUrl });

  assert.equal(env.DATABASE_URL, configuredUrl);
});
