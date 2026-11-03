const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

test("the CMS layer is gone: no config, no local API, no admin UI, no CLI", () => {
  assert.equal(exists("payload.config.ts"), false);
  assert.equal(exists("lib/payload-native.ts"), false);
  assert.equal(exists("scripts/payload-cli.cjs"), false);
  assert.equal(exists("app/(payload)"), false);
  assert.equal(exists("tests/helpers/native-payload-mock.cjs"), false);
  const payloadCode = exists("payload")
    ? fs.readdirSync(path.join(root, "payload")).filter((entry) => !entry.startsWith("pip.db"))
    : [];
  assert.deepEqual(payloadCode, [], "payload/ keeps the database file only");
});

test("no dependency, alias or Next plugin pulls Payload back in", () => {
  const pkg = JSON.parse(read("package.json"));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const payloadPackages = Object.keys(declared).filter(
    (name) => name === "payload" || name.startsWith("@payloadcms/"),
  );
  assert.deepEqual(payloadPackages, [], "Payload packages must be uninstalled");
  const scripts = Object.values(pkg.scripts).filter((command) => command.includes("payload-cli"));
  assert.deepEqual(scripts, [], "no npm script may shell out to the Payload CLI");

  assert.equal(read("next.config.mjs").includes("payload"), false);
  assert.equal(read("tsconfig.json").includes("payload"), false);
  assert.equal(read("proxy.ts").includes("/payload"), false, "no guarded CMS route is left behind");
});

test("application code reads the database directly instead of a CMS client", () => {
  const offenders = [];
  for (const directory of ["app", "lib", "components", "scripts"]) {
    const walk = (relative) => {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const next = path.join(relative, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (/\.(ts|tsx|cjs|mjs)$/.test(entry.name) && !next.includes("node_modules")) {
          const source = read(next);
          // Проверяем реальные импорты, а не упоминания в комментариях и документации.
          if (/from\s+["']@(?:\/lib\/payload-native|payloadcms\/)[^"']*["']/.test(source)) offenders.push(next);
        }
      }
    };
    walk(directory);
  }
  assert.deepEqual(offenders, []);
});

test("the staff gate resolves roles from our own accounts table on every request", () => {
  const source = read("lib/admin-session.ts");
  assert.match(source, /from accounts where id = \?/);
  assert.match(source, /is_blocked === 1/);
  assert.equal(source.includes("payload"), false, "guards never consult the CMS layer");
});

test("credentials, MFA and session code never look up accounts through a CMS", () => {
  for (const file of [
    "lib/credentials.ts",
    "lib/pending-login.ts",
    "app/actions/auth.ts",
    "app/actions/mfa.ts",
    "app/actions/user.ts",
    "app/actions/account.ts",
    "auth.ts",
  ]) {
    assert.equal(read(file).includes("payload-native"), false, `${file} must use the SQL layer`);
    assert.equal(read(file).includes("payload/payload-types"), false, `${file} must not depend on generated CMS types`);
  }
});

test("the blog renders Lexical JSON with our own converter", () => {
  assert.equal(read("lib/data.ts").includes("@payloadcms/richtext-lexical"), false);
  const converter = read("lib/lexical-html.ts");
  assert.match(converter, /export function lexicalToHtml/);
  assert.match(converter, /escapeHtml/, "editor text must be escaped");
  assert.ok(converter.includes("https?:"), "links are limited to http(s) and local paths");
});
