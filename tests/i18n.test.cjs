const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Only lib/validators.ts is loaded as TypeScript, for the limits it exports.
require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename
  );
};

const rootDir = path.join(__dirname, "..");
const locales = ["en", "ru"];
const catalogs = Object.fromEntries(
  locales.map((locale) => [locale, JSON.parse(fs.readFileSync(path.join(rootDir, "messages", `${locale}.json`), "utf8"))])
);

/** `a.b.c` → value, walking nested catalogs. */
function lookup(catalog, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), catalog);
}

function flatten(node, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(node ?? {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
}

const placeholdersOf = (message) =>
  [...String(message ?? "").matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "generated", "public", "docs"]);

function sourceFiles() {
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path.join(current, entry.name));
        continue;
      }
      if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) found.push(path.join(current, entry.name));
    }
  };
  walk(rootDir);
  return found;
}

/**
 * Translator variables of one file: `const t = useTranslations("admin")` and the server-side
 * `getTranslations("admin")` / `getActionTranslator()` (which is bound to `actions.*`).
 */
function translatorsOf(source) {
  const translators = new Map();
  const pattern = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)")?\s*\)/g;
  for (const match of source.matchAll(pattern)) translators.set(match[1], match[2] ?? "");
  if (/getActionTranslator\(/.test(source)) translators.set("t", "actions");
  return translators;
}

/** Literal `t("key")` / `t("key", { count })` calls, with whether values were passed. */
function translationCalls(source) {
  const calls = [];
  const pattern = /\b(\w+)\(\s*"([a-zA-Z0-9_.]+)"\s*(,[^)]*)?\)/g;
  for (const match of source.matchAll(pattern)) {
    calls.push({ translator: match[1], key: match[2], hasValues: Boolean(match[3]) });
  }
  return calls;
}

test("both locales carry the same keys", () => {
  const flattened = Object.fromEntries(locales.map((locale) => [locale, flatten(catalogs[locale])]));
  const english = [...flattened.en.keys()].sort();

  for (const locale of locales.slice(1)) {
    const other = [...flattened[locale].keys()].sort();
    assert.deepEqual(
      other.filter((key) => !flattened.en.has(key)),
      [],
      `${locale}.json has keys that en.json does not`
    );
    assert.deepEqual(
      english.filter((key) => !flattened[locale].has(key)),
      [],
      `${locale}.json is missing keys from en.json`
    );
  }
});

test("placeholders match between locales", () => {
  const english = flatten(catalogs.en);

  for (const [key, message] of english) {
    for (const locale of locales.slice(1)) {
      assert.deepEqual(
        placeholdersOf(lookup(catalogs[locale], key)),
        placeholdersOf(message),
        `${locale}.json → ${key} uses different placeholders than en.json`
      );
    }
  }
});

test("every translated key exists and receives the values its message needs", () => {
  const problems = [];

  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    const translators = translatorsOf(source);
    if (translators.size === 0) continue;

    for (const call of translationCalls(source)) {
      if (!translators.has(call.translator)) continue;
      const namespace = translators.get(call.translator);
      const key = namespace ? `${namespace}.${call.key}` : call.key;

      for (const locale of locales) {
        const message = lookup(catalogs[locale], key);
        if (typeof message !== "string") {
          problems.push(`${path.relative(rootDir, file)}: ${key} is missing in ${locale}.json`);
          continue;
        }
        const required = placeholdersOf(message);
        if (required.length > 0 && !call.hasValues) {
          // Renders as a FORMATTING_ERROR at runtime: the visitor sees the key instead of text.
          problems.push(
            `${path.relative(rootDir, file)}: ${key} needs {${required.join(", ")}} but is called without values`
          );
        }
      }
    }
  }

  assert.deepEqual(problems, []);
});

test("blog empty states use the existing nested catalog messages", () => {
  for (const locale of locales) {
    assert.equal(typeof lookup(catalogs[locale], "blog.empty.title"), "string");
    assert.equal(typeof lookup(catalogs[locale], "blog.empty.description"), "string");
  }
  for (const file of ["app/page.tsx", "app/blog/(index)/page.tsx", "app/shop/[slug]/content.tsx"]) {
    const source = fs.readFileSync(path.join(rootDir, file), "utf8");
    assert.ok(source.includes('empty.title'), `${file} must read blog.empty.title`);
    assert.ok(source.includes('empty.description'), `${file} must read blog.empty.description`);
  }
});

test("money and price prefixes follow the active locale without losing the ruble sign", () => {
  const { formatKopecks, pricePrefix } = require("../lib/pricing.ts");
  assert.equal(formatKopecks(1_560_000, "RUB", "en"), "15,600 ₽");
  assert.match(formatKopecks(1_560_000, "RUB", "ru"), /^15[ \u00a0\u202f]600 ₽$/);
  assert.equal(pricePrefix("from", "en"), "From ");
  assert.equal(pricePrefix("from", "ru"), "от ");
  assert.equal(pricePrefix("fixed", "en"), "");
});

test("shared Spectrum tables take their controls and accessibility labels from the catalogs", () => {
  const source = fs.readFileSync(path.join(rootDir, "components/spectrumui/data-table.tsx"), "utf8");
  assert.ok(source.includes('useTranslations("admin.dataTable")'));
  for (const stale of [
    'aria-label="Clear search"',
    'aria-label="Pagination"',
    'aria-label="Previous page"',
    'aria-label="Next page"',
    "searchPlaceholder = 'Search'",
    "'No matching rows'",
    "'Loading rows'",
  ]) {
    assert.equal(source.includes(stale), false, `hardcoded table copy remains: ${stale}`);
  }
});

test("the validator limits quoted in the messages are the real ones", () => {
  // lib/validators.ts promises that the numbers in `actions.validation.*` mirror its constants.
  const { MAX_NAME_LENGTH, MAX_PASSWORD_BYTES, MAX_SLUG_LENGTH, MIN_PASSWORD_LENGTH } = require("../lib/validators.ts");

  const expected = {
    passwordTooShort: String(MIN_PASSWORD_LENGTH),
    passwordTooLong: String(MAX_PASSWORD_BYTES),
    nameTooLong: String(MAX_NAME_LENGTH),
    slugTooLong: String(MAX_SLUG_LENGTH),
  };

  for (const locale of locales) {
    for (const [key, value] of Object.entries(expected)) {
      const message = String(lookup(catalogs[locale], `actions.validation.${key}`));
      assert.ok(message.includes(value), `${locale}.json → actions.validation.${key} must mention ${value}: "${message}"`);
    }
  }
});
