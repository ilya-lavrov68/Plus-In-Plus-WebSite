const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Loads the project's TypeScript modules in plain Node, exactly like the app does
// through the Next.js compiler.
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const rootDir = path.join(__dirname, "..");
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(rootDir, name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { parseLineList, parseJsonArray, toJsonArray } = require("../lib/db-helpers.ts");
const {
  describeDatabaseUrl,
  ensureLocalDatabaseDirectory,
  localDatabaseUrl,
  resolveDatabaseConfig,
  unsupportedDatabaseUrlMessage,
} = require("../lib/database.ts");
const { slugify, withNumericSuffix } = require("../lib/slug.ts");
const { checkRateLimit, hashRateLimitIdentifier } = require("../lib/rate-limit.ts");
const validators = require("../lib/validators.ts");

const schema = fs.readFileSync(path.join(rootDir, "db", "schema.sql"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

// ---------------------------------------------------------------------------
// One database for development and production
// ---------------------------------------------------------------------------

test("one libSQL/SQLite database is described by db/schema.sql, without ORM migrations", () => {
  assert.match(schema, /CREATE TABLE `accounts`/);
  assert.match(schema, /CREATE TABLE `services`/);
  assert.match(schema, /CREATE TABLE `posts`/);
  assert.match(schema, /CREATE TABLE `activity_logs`/);
  assert.match(schema, /CREATE TABLE `orders`/);
  assert.match(schema, /CREATE TABLE `payments`/);
  assert.match(schema, /DEFAULT 'USER'/);
  assert.match(schema, /DEFAULT 'cart'/);
  assert.doesNotMatch(schema, /prisma|postgres/i);
  assert.equal(fs.existsSync(path.join(rootDir, "payload.config.ts")), false);
});

test("the native SQLite adapter remains installed without Prisma or PostgreSQL drivers", () => {
  assert.ok(packageJson.dependencies["@libsql/client"]);
  assert.ok(packageJson.dependencies.zod);
  for (const dependency of ["payload", "@payloadcms/db-sqlite", "prisma", "@prisma/client", "pg", "@db/adapter-pg", "@db/adapter-libsql"]) {
    assert.equal(packageJson.dependencies[dependency], undefined, dependency);
  }
  for (const script of ["db:check", "db:migrate", "db:promote-admin", "deploy:verify"]) {
    assert.ok(packageJson.scripts[script], script);
    const command = packageJson.scripts[script].split(" ")[1];
    assert.ok(fs.existsSync(path.join(rootDir, command)), script);
  }
  assert.equal(packageJson.scripts["payload:migrate"], undefined);
  assert.equal(packageJson.scripts["db:push"], undefined);
});

test("staff role runbook changes the role through SQL and revokes live sessions", () => {
  assert.equal(packageJson.scripts["db:promote-admin"], "node scripts/run-ts.cjs scripts/promote-admin.ts");
  const source = fs.readFileSync(path.join(rootDir, "scripts", "promote-admin.ts"), "utf8");
  assert.match(source, /findAccountByEmail/);
  assert.match(source, /updateAccount\(/);
  assert.match(source, /revokeAllAuthSessions\(/);
  assert.match(source, /from "@\/lib\/db"/);
  assert.doesNotMatch(source, /getPayloadClient|closePayloadClient/);
  assert.equal(fs.existsSync(path.join(rootDir, "scripts", "promote-admin.cjs")), false);
});

test("database resolution prefers Turso and falls back to the local file in development", () => {
  const production = resolveDatabaseConfig({ env: { NODE_ENV: "production" }, rootDir: "/app" });
  assert.equal(production, null, "production must fail closed without configuration");

  const development = resolveDatabaseConfig({ env: {}, rootDir: "/app" });
  assert.deepEqual(development, {
    url: `file:${path.join("/app", "payload", "pip.db")}`,
    authToken: undefined,
    remote: false,
  });

  // DATABASE_URL — канонический адрес базы; PAYLOAD_DATABASE_URL остался алиасом.
  const turso = resolveDatabaseConfig({
    env: { DATABASE_URL: "libsql://plus-in-plus-org.turso.io", DATABASE_AUTH_TOKEN: " token-value " },
    rootDir: "/app",
  });
  assert.equal(turso.url, "libsql://plus-in-plus-org.turso.io");
  assert.equal(turso.authToken, "token-value");
  assert.equal(turso.remote, true);

  const alias = resolveDatabaseConfig({
    env: { PAYLOAD_DATABASE_URL: "libsql://legacy-alias.turso.io", TURSO_AUTH_TOKEN: "alias-token" },
    rootDir: "/app",
  });
  assert.equal(alias.url, "libsql://legacy-alias.turso.io");
  assert.equal(alias.authToken, "alias-token");
  assert.equal(alias.remote, true);

  const canonicalWins = resolveDatabaseConfig({
    env: { DATABASE_URL: "file:canonical.db", PAYLOAD_DATABASE_URL: "file:legacy.db" },
    rootDir: "/app",
  });
  assert.equal(canonicalWins.url, `file:${path.join("/app", "canonical.db")}`);

  const relative = resolveDatabaseConfig({ env: { TURSO_DATABASE_URL: "file:local.db" }, rootDir: "/app" });
  assert.equal(relative.url, `file:${path.join("/app", "local.db")}`);

  const sqld = resolveDatabaseConfig({ env: { TURSO_DATABASE_URL: "https://sqld.example:8080" }, rootDir: "/app" });
  assert.equal(sqld.remote, true);
});

test("a PostgreSQL URL is reported and rejected instead of being silently used", () => {
  const legacy = "postgresql://postgres:secret@localhost:5432/plus_in_plus";
  assert.match(unsupportedDatabaseUrlMessage({ DATABASE_URL: legacy }), /not a libSQL\/SQLite URL/);
  assert.match(unsupportedDatabaseUrlMessage({ PAYLOAD_DATABASE_URL: legacy }), /not a libSQL\/SQLite URL/);
  assert.equal(unsupportedDatabaseUrlMessage({ DATABASE_URL: "file:local.db" }), null);

  for (const name of ["DATABASE_URL", "PAYLOAD_DATABASE_URL", "TURSO_DATABASE_URL"]) {
    assert.throws(
      () => resolveDatabaseConfig({ env: { [name]: legacy } }),
      /must start with "libsql:"/,
      name,
    );
  }
  assert.equal(resolveDatabaseConfig({ env: { NODE_ENV: "production" } }), null);
});

test("log output never exposes credentials", () => {
  assert.equal(describeDatabaseUrl("libsql://db-org.turso.io?authToken=super-secret"), "libsql://db-org.turso.io?authToken=***");
  assert.equal(describeDatabaseUrl("https://user:password@sqld.example"), "https://***@sqld.example/");
  assert.equal(localDatabaseUrl("/app").endsWith("/payload/pip.db"), true);
});

// ---------------------------------------------------------------------------
// JSON columns as TEXT
// ---------------------------------------------------------------------------

test("JSON list helpers round-trip and never throw on broken data", () => {
  assert.equal(toJsonArray(["One", "Two"]), '["One","Two"]');
  assert.deepEqual(parseJsonArray(toJsonArray(["One", "Two"])), ["One", "Two"]);
  for (const value of [null, undefined, "", "   ", "not json", "{\"a\":1}", '["ok",1,null,"fine"]', 42]) {
    const parsed = parseJsonArray(value);
    assert.ok(Array.isArray(parsed), String(value));
    assert.ok(parsed.every((item) => typeof item === "string"), String(value));
  }
  // A legacy PostgreSQL Json column returns a real array.
  assert.deepEqual(parseJsonArray(["Kept"]), ["Kept"]);
  assert.deepEqual(parseLineList(" One \n\n Two\nThree "), ["One", "Two", "Three"]);
  assert.deepEqual(parseLineList(""), []);
});

test("slug generation transliterates Russian titles and stays ASCII", () => {
  assert.equal(slugify("Sign Design"), "sign-design");
  assert.equal(slugify("  Вывеска  для кафе  "), "vyveska-dlya-kafe");
  assert.equal(slugify("Реклама №1 (свет)"), "reklama-1-svet");
  assert.equal(slugify("!!!"), "item");
  assert.equal(slugify("!!!", "service"), "service");
  assert.equal(slugify("Ünïcode Ça Va"), "unicode-ca-va");
  assert.ok(slugify("Д".repeat(400)).length <= 120);
  assert.equal(withNumericSuffix("sign", 1), "sign");
  assert.equal(withNumericSuffix("sign", 3), "sign-3");
  assert.equal(withNumericSuffix("x".repeat(120), 12).length, 120);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test("registerSchema keeps the documented password and name rules", () => {
  const valid = { firstName: " First ", lastName: "Last", email: " PERSON@Example.com ", password: "a-Long-passphrase1", confirmPassword: "a-Long-passphrase1" };
  const parsed = validators.registerSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.email, "person@example.com");
  assert.equal(parsed.data.firstName, "First");

  for (const broken of [
    { ...valid, firstName: " " },
    { ...valid, lastName: "x".repeat(81) },
    { ...valid, lastName: "bad\u0000name" },
    { ...valid, password: "short", confirmPassword: "short" },
    { ...valid, confirmPassword: "different" },
    { ...valid, email: "not-an-email" },
    { ...valid, password: "🙂".repeat(19), confirmPassword: "🙂".repeat(19) },
  ]) {
    assert.equal(validators.registerSchema.safeParse(broken).success, false, JSON.stringify(broken).slice(0, 80));
  }
  assert.equal(validators.registerSchema.safeParse(valid).data.password, "a-Long-passphrase1");
});

test("service and post schemas reject what the database cannot store safely", () => {
  const service = {
    title: "Title", slug: "sign-design", category: "small", shortDesc: "Short", fullDesc: "Full",
    includes: ["One"], shapes: ["Round"], resultText: "Result", isPublished: true,
  };
  assert.equal(validators.createServiceSchema.safeParse(service).success, true);
  // The slug is optional for services: it is derived from the title.
  const withoutSlug = { ...service };
  delete withoutSlug.slug;
  assert.equal(validators.createServiceSchema.safeParse(withoutSlug).success, true);
  for (const broken of [
    { ...service, category: "other" },
    { ...service, slug: "../escape" },
    { ...service, includes: [] },
    { ...service, shapes: [] },
    { ...service, title: "" },
  ]) {
    assert.equal(validators.createServiceSchema.safeParse(broken).success, false, JSON.stringify(broken).slice(0, 80));
  }

  const post = { title: "Post", slug: "post-slug", excerpt: "Excerpt", content: "<p>Article</p>", readTime: 5, isPublished: true };
  assert.equal(validators.createPostSchema.safeParse(post).success, true);
  for (const broken of [{ ...post, slug: "../escape" }, { ...post, readTime: 1.5 }, { ...post, readTime: 0 }, { ...post, readTime: 2000 }, { ...post, content: " " }]) {
    assert.equal(validators.createPostSchema.safeParse(broken).success, false, JSON.stringify(broken).slice(0, 80));
  }
});

test("rate limiting is still in-process, hashed and bounded", () => {
  const key = hashRateLimitIdentifier("register:unit-test-address");
  assert.ok(!key.includes("unit-test-address"));
  assert.equal(checkRateLimit(`test:${key}`, 2, 1000, 0).allowed, true);
  assert.equal(checkRateLimit(`test:${key}`, 2, 1000, 1).allowed, true);
  assert.equal(checkRateLimit(`test:${key}`, 2, 1000, 2).allowed, false);
  assert.equal(checkRateLimit(`test:${key}`, 2, 1000, 2_000).allowed, true);
});

test("a local file URL gets its directory created before the first connection", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pip-db-dir-"));
  try {
    const nested = path.join(sandbox, "payload", "nested");
    assert.equal(fs.existsSync(nested), false);

    // libSQL не создаёт каталоги сам: на свежем клоне папки payload/ нет, и
    // db:migrate падал с SQLITE_CANTOPEN вместо применения схемы.
    ensureLocalDatabaseDirectory(`file:${path.join(nested, "pip.db")}`);
    assert.equal(fs.existsSync(nested), true);

    ensureLocalDatabaseDirectory("file:./relative/deep.db", sandbox);
    assert.equal(fs.existsSync(path.join(sandbox, "relative")), true);

    // Удалённые базы и память каталогов не требуют.
    for (const url of ["libsql://db.turso.io", "https://sqld.example:8080", ":memory:", "file::memory:?"]) {
      assert.doesNotThrow(() => ensureLocalDatabaseDirectory(url, sandbox));
    }
    assert.deepEqual(
      fs.readdirSync(sandbox).sort(),
      ["payload", "relative"],
      "no stray directories are created next to the database",
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
