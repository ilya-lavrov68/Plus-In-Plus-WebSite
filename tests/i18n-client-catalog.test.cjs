const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
};

const catalogSource = read("i18n-catalog.ts");

/** Namespace, объявленные для браузера: `site` и `admin`. */
function declaredNamespaces(constant) {
  const start = catalogSource.indexOf(`export const ${constant}`);
  assert.ok(start >= 0, `${constant} объявлен в i18n-catalog.ts`);
  const block = catalogSource.slice(start, catalogSource.indexOf("] as const", start));
  const own = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  // Списки админки расширяют публичный через spread объявленной константы.
  const spread = [...block.matchAll(/\.\.\.(CLIENT_MESSAGE_NAMESPACES)/g)].flatMap((match) => [
    ...declaredNamespaces(match[1]),
  ]);
  return new Set([...own, ...spread]);
}

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/** Разрешение импорта в файл репозитория. */
function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  else return null;

  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
    ...EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];
  return candidates.find(exists) ?? null;
}

function importedModules(relative) {
  const source = read(relative);
  const specifiers = [
    ...source.matchAll(/from\s*["']([^"']+)["']/g),
    ...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
    ...source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]);

  return specifiers.map((specifier) => resolveImport(relative, specifier)).filter(Boolean);
}

function filesUnder(relativeDir) {
  const files = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(tsx|ts)$/.test(entry.name)) files.push(next);
    }
  };
  walk(relativeDir);
  return files;
}

/** Все клиентские модули, достижимые из указанных entry-файлов. */
function clientModules(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...importedModules(current));
  }
  return [...seen].filter((file) => /^\s*["']use client["']/.test(read(file)));
}

function usedNamespaces(files) {
  const used = new Map();
  for (const file of files) {
    const source = read(file);
    // Namespace обязан быть литералом: иначе статический анализ каталога
    // не сможет гарантировать, что строка попадёт в браузер.
    assert.doesNotMatch(
      source,
      /use(?:Translations|Messages)\(\s*[^"'`)]/,
      `${file}: namespace транслятора должен быть строковым литералом`,
    );
    for (const match of source.matchAll(/use(?:Translations|Messages)\(\s*["']([^"']+)["']/g)) {
      const namespace = match[1].split(".")[0];
      if (!used.has(namespace)) used.set(namespace, file);
    }
  }
  return used;
}

const siteEntries = filesUnder("app/(site)");
const adminEntries = filesUnder("app/(admin)");

const siteUsed = usedNamespaces(clientModules(siteEntries));
const adminUsed = usedNamespaces(clientModules(adminEntries));

/**
 * Клиентский провайдер отдаёт браузеру урезанный каталог. Если компонент с
 * `"use client"` запросит namespace, которого там нет, next-intl отрендерит
 * `MISSING_MESSAGE` прямо в интерфейсе. Тест сверяет объявленные списки с
 * фактическими вызовами `useTranslations` в клиентских модулях разделов.
 */
test("каталог публичных страниц покрывает их клиентские компоненты", () => {
  const declared = declaredNamespaces("CLIENT_MESSAGE_NAMESPACES");
  const missing = [...siteUsed.keys()].filter((namespace) => !declared.has(namespace));
  assert.deepEqual(
    missing.map((namespace) => `${namespace} (${siteUsed.get(namespace)})`),
    [],
    "namespace используется в браузере, но не объявлен в CLIENT_MESSAGE_NAMESPACES",
  );

  const unused = [...declared].filter((namespace) => !siteUsed.has(namespace));
  assert.deepEqual(unused, [], "объявленный namespace не используется — лишний вес в HTML");
});

test("каталог админки покрывает её клиентские компоненты", () => {
  const declared = declaredNamespaces("ADMIN_CLIENT_MESSAGE_NAMESPACES");
  const missing = [...adminUsed.keys()].filter((namespace) => !declared.has(namespace));
  assert.deepEqual(
    missing.map((namespace) => `${namespace} (${adminUsed.get(namespace)})`),
    [],
    "namespace используется в браузере админки, но не объявлен в ADMIN_CLIENT_MESSAGE_NAMESPACES",
  );
});

test("публичный сайт не отдаёт строки панели управления", () => {
  const declared = declaredNamespaces("CLIENT_MESSAGE_NAMESPACES");
  assert.equal(declared.has("admin"), false, "публичные страницы не получают namespace admin");
  assert.equal("actions" in Object.fromEntries([...declared].map((key) => [key, true])), false);
});

test("каталог для браузера заметно меньше полного словаря", () => {
  const ru = JSON.parse(read("messages/ru.json"));
  const sizeOf = (namespaces) =>
    [...namespaces].reduce(
      (sum, namespace) => sum + Buffer.byteLength(JSON.stringify(ru[namespace] ?? {}), "utf8"),
      0,
    );

  const fullBytes = Buffer.byteLength(JSON.stringify(ru), "utf8");
  const siteBytes = sizeOf(declaredNamespaces("CLIENT_MESSAGE_NAMESPACES"));
  const adminBytes = sizeOf(declaredNamespaces("ADMIN_CLIENT_MESSAGE_NAMESPACES"));

  assert.ok(siteBytes > 0, "каталог публичных страниц не пустой");
  assert.ok(
    siteBytes < fullBytes * 0.3,
    `публичным страницам уходит ${siteBytes} из ${fullBytes} байт — ожидали меньше трети`,
  );
  assert.ok(
    adminBytes < fullBytes * 0.7,
    `админке уходит ${adminBytes} из ${fullBytes} байт — ожидали заметно меньше полного словаря`,
  );
});
