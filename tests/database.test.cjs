const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Loads the project's TypeScript modules in plain Node, exactly like the app does
// through the Next.js compiler.
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const rootDir = path.join(__dirname, "..");
const { parseLineList, parseJsonArray, toJsonArray } = require("../lib/db-helpers.ts");
const { describeDatabaseUrl, localDatabaseUrl, resolveDatabaseConfig, unsupportedDatabaseUrlMessage } = require("../lib/database.ts");
const { slugify, withNumericSuffix } = require("../lib/slug.ts");
const { checkRateLimit, hashRateLimitIdentifier } = require("../lib/rate-limit.ts");
const validators = require("../lib/validators.ts");

const schema = fs.readFileSync(path.join(rootDir, "prisma", "schema.prisma"), "utf8");
const prismaClientSource = fs.readFileSync(path.join(rootDir, "lib", "prisma.ts"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

// ---------------------------------------------------------------------------
// One database for development and production
// ---------------------------------------------------------------------------

test("the schema targets libSQL/SQLite with explicit table names and one datasource", () => {
  assert.match(schema, /datasource\s+db\s*\{[^}]*provider\s*=\s*"sqlite"/s);
  // A libSQL endpoint is not a PostgreSQL server: PostgreSQL here would be a lie
  // that only surfaces as "table does not exist" in production.
  assert.doesNotMatch(schema, /provider\s*=\s*"postgresql"/);
  assert.doesNotMatch(schema, /enum\s+Role/);
  assert.doesNotMatch(schema, /\bJson\b/);
  for (const mapping of ['@@map("users")', '@@map("services")', '@@map("posts")', '@@map("activity_logs")']) {
    assert.ok(schema.includes(mapping), mapping);
  }
  assert.match(schema, /slug\s+String\s+@unique/);
  assert.match(schema, /includes\s+String/);
  assert.match(schema, /shapes\s+String/);
  assert.match(schema, /role\s+String\s+@default\("USER"\)/);
});

test("the runtime client uses the libSQL adapter and no PostgreSQL driver remains", () => {
  assert.match(prismaClientSource, /@prisma\/adapter-libsql/);
  assert.doesNotMatch(prismaClientSource, /adapter-pg|PrismaPg/);
  assert.equal(packageJson.dependencies.pg, undefined);
  assert.equal(packageJson.dependencies["@prisma/adapter-pg"], undefined);
  assert.equal(packageJson.dependencies["@prisma/adapter-libsql"], "6.19.3");
  assert.ok(packageJson.dependencies["@libsql/client"]);
  assert.ok(packageJson.dependencies.zod);
  for (const script of ["db:push", "db:check", "db:promote-admin", "db:migrate-from-postgres"]) {
    assert.ok(packageJson.scripts[script], script);
    assert.ok(fs.existsSync(path.join(rootDir, packageJson.scripts[script].split(" ")[1])), script);
  }
});

test("database resolution prefers Turso and falls back to the local file in development", () => {
  const production = resolveDatabaseConfig({ env: { NODE_ENV: "production" }, rootDir: "/app" });
  assert.equal(production, null, "production must fail closed without configuration");

  const development = resolveDatabaseConfig({ env: {}, rootDir: "/app" });
  assert.deepEqual(development, {
    url: `file:${path.join("/app", "prisma", "dev.db")}`,
    authToken: undefined,
    remote: false,
    ignoredUrl: undefined,
  });

  const turso = resolveDatabaseConfig({
    env: { TURSO_DATABASE_URL: "libsql://plus-in-plus-org.turso.io", TURSO_AUTH_TOKEN: " token-value " },
    rootDir: "/app",
  });
  assert.equal(turso.url, "libsql://plus-in-plus-org.turso.io");
  assert.equal(turso.authToken, "token-value");
  assert.equal(turso.remote, true);

  const relative = resolveDatabaseConfig({ env: { TURSO_DATABASE_URL: "file:local.db" }, rootDir: "/app" });
  assert.equal(relative.url, `file:${path.join("/app", "local.db")}`);

  const sqld = resolveDatabaseConfig({ env: { TURSO_DATABASE_URL: "https://sqld.example:8080" }, rootDir: "/app" });
  assert.equal(sqld.remote, true);
});

test("a leftover PostgreSQL DATABASE_URL is reported, never silently used", () => {
  const legacy = "postgresql://postgres:secret@localhost:5432/plus_in_plus";
  const development = resolveDatabaseConfig({ env: { DATABASE_URL: legacy }, rootDir: "/app" });
  assert.equal(development.url, `file:${path.join("/app", "prisma", "dev.db")}`);
  assert.equal(development.ignoredUrl, legacy);
  assert.match(unsupportedDatabaseUrlMessage({ DATABASE_URL: legacy }), /not a libSQL\/SQLite URL/);
  assert.equal(unsupportedDatabaseUrlMessage({ DATABASE_URL: "file:local.db" }), null);
  assert.equal(resolveDatabaseConfig({ env: { NODE_ENV: "production", DATABASE_URL: legacy } }), null);

  assert.throws(
    () => resolveDatabaseConfig({ env: { TURSO_DATABASE_URL: legacy } }),
    /must start with "libsql:"/,
  );
});

test("log output never exposes credentials", () => {
  assert.equal(describeDatabaseUrl("libsql://db-org.turso.io?authToken=super-secret"), "libsql://db-org.turso.io?authToken=***");
  assert.equal(describeDatabaseUrl("https://user:password@sqld.example"), "https://***@sqld.example/");
  assert.equal(localDatabaseUrl("/app").endsWith("/prisma/dev.db"), true);
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
  const valid = { firstName: " First ", lastName: "Last", email: " PERSON@Example.com ", password: "a-long-passphrase", confirmPassword: "a-long-passphrase" };
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
  assert.equal(validators.registerSchema.safeParse(valid).data.password, "a-long-passphrase");
});

test("service and post schemas reject what the database cannot store safely", () => {
  const service = {
    title: "Title", slug: "sign-design", category: "small", shortDesc: "Short", fullDesc: "Full",
    includes: ["One"], shapes: ["Round"], resultText: "Result", isPublished: true,
  };
  assert.equal(validators.createServiceSchema.safeParse(service).success, true);
  // The slug is optional for services: it is derived from the title.
  const { slug, ...withoutSlug } = service;
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
