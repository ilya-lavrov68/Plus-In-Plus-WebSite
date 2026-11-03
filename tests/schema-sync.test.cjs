const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createClient } = require("@libsql/client");
const { EXPECTED_TABLES, checkSchema } = require("../scripts/lib/schema-check.cjs");

test("read-only schema check accepts the complete schema and reports missing tables", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pip-schema-check-"));
  const url = `file:${path.join(directory, "check.db")}`;
  const client = createClient({ url });
  try {
    for (const table of EXPECTED_TABLES) await client.execute(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY)`);
    const before = await client.execute("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table'");
    assert.deepEqual(await checkSchema({ url, authToken: undefined }), { ok: true, missingTables: [], missingColumns: [] });
    const after = await client.execute("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table'");
    assert.equal(after.rows[0].total, before.rows[0].total, "checkSchema never performs DDL");
    await client.execute("DROP TABLE payments");
    const missing = await checkSchema({ url, authToken: undefined });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missingTables, ["payments"]);
  } finally {
    client.close();
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test("reviewed schema preserves cart, order and payment uniqueness contracts", () => {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  for (const index of ["orders_order_number_idx", "orders_cart_key_idx", "payments_provider_key_idx", "accounts_email_idx"]) {
    assert.ok(schema.includes(index), index);
  }
  assert.match(schema, /CREATE UNIQUE INDEX/);
  assert.match(schema, /CREATE TABLE `orders`/);
  assert.match(schema, /CREATE TABLE `order_items`/);
  assert.doesNotMatch(schema, /prisma|db push/i);
});

test("Node CLI loaders use file URLs instead of raw Windows drive-letter paths", () => {
  for (const filename of ["run-ts.cjs"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", "scripts", filename), "utf8");
    assert.match(source, /require\("node:url"\)/, filename);
    assert.match(
      source,
      /pathToFileURL\(path\.join\(__dirname, "lib", "ts-loader\.mjs"\)\)\.href/,
      `${filename} must pass a file:// URL to --loader`,
    );
  }
});

test("repository and CI apply db/schema.sql instead of CMS-generated migrations", () => {
  const root = path.join(__dirname, "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["db:migrate"], "node scripts/db-migrate.cjs");
  assert.ok(fs.existsSync(path.join(root, "db", "schema.sql")));
  assert.equal(pkg.scripts["db:push"], undefined);
  assert.equal(fs.existsSync(path.join(root, "scripts", "lib", "db-cli.cjs")), false);
  const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(ci, /npm run db:migrate/);
  assert.match(ci, /npm run db:check/);
  assert.match(ci, /runs-on: windows-latest/);
  assert.doesNotMatch(ci, /prisma|db push|payload:migrate/i);
});
