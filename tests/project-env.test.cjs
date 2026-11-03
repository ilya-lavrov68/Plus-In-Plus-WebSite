const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadProjectEnv } = require("../scripts/lib/project-env.cjs");

test("plain Node CLI loads env files without overriding the shell", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pip-project-env-"));
  try {
    await fs.promises.writeFile(path.join(directory, ".env"), [
      "EXTRA_SECRET=base-extra-secret",
      "AUTH_SECRET=base-auth-secret",
      "DATABASE_URL=file:./payload/from-base.db",
      "BASE_ONLY=present",
      "",
    ].join("\n"));
    await fs.promises.writeFile(path.join(directory, ".env.local"), [
      "EXTRA_SECRET=local-extra-secret",
      "AUTH_SECRET=local-auth-secret",
      "",
    ].join("\n"));

    const env = { NODE_ENV: "development", AUTH_SECRET: "explicit-shell-secret" };
    loadProjectEnv(directory, env);
    assert.equal(env.EXTRA_SECRET, "local-extra-secret", ".env.local has priority over .env");
    assert.equal(env.AUTH_SECRET, "explicit-shell-secret", "an exported variable is never overwritten");
    assert.equal(env.DATABASE_URL, "file:./payload/from-base.db");
    assert.equal(env.BASE_ONLY, "present");

    const productionEnv = { NODE_ENV: "production" };
    loadProjectEnv(directory, productionEnv);
    assert.equal(productionEnv.EXTRA_SECRET, "local-extra-secret");
    assert.equal(productionEnv.AUTH_SECRET, "local-auth-secret");

    assert.doesNotThrow(() => loadProjectEnv(path.join(directory, "missing"), {}));
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
