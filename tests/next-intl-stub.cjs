/**
 * Minimal `next-intl` stand-in for the component tests.
 *
 * The components render through react-test-renderer without a
 * `NextIntlClientProvider`, so `useTranslations` is resolved straight from the
 * canonical English catalog. A key that is missing from `messages/en.json`
 * throws, which keeps the catalogs honest.
 */
const messages = require("../messages/en.json");

function lookup(path) {
  return path.split(".").reduce((node, part) => (node == null ? undefined : node[part]), messages);
}

function interpolate(value, params) {
  if (typeof value !== "string" || !params) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

function resolve(namespace, key) {
  const direct = lookup(`${namespace}.${key}`);
  if (direct !== undefined) return direct;
  const bare = lookup(key);
  if (bare !== undefined) return bare;
  throw new Error(`next-intl stub: missing message "${namespace}.${key}"`);
}

function createTranslator(namespace) {
  const translate = (key, params) => {
    const value = resolve(namespace, key);
    if (typeof value === "string") return interpolate(value, params);
    if (typeof value === "number") return String(value);
    return translate.raw(key);
  };
  translate.raw = (key) => resolve(namespace, key);
  translate.rich = (key, params) => interpolate(resolve(namespace, key), params);
  translate.markup = (key, params) => interpolate(resolve(namespace, key), params);
  return translate;
}

module.exports = {
  NextIntlClientProvider: ({ children }) => children ?? null,
  useTranslations: createTranslator,
  useLocale: () => "en",
  useFormatter: () => ({ dateTime: (value) => String(value), number: (value) => String(value) }),
  getTranslations: async (namespace) => createTranslator(namespace),
  getLocale: async () => "en",
};
