import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

import type { RequestLocale } from "@/lib/request-locale";

/**
 * Translator of one namespace. Callable for text messages (with `{name}`
 * placeholders) and exposing `raw` for message nodes that hold arrays or
 * objects, such as the reference article sections and the Sign Design copy.
 */
export interface MessageTranslator {
  (key: string, values?: Record<string, string | number>): string;
  raw(key: string): unknown;
}

/**
 * Pure, dependency-free access to the same catalogs next-intl serves to the
 * client components (`messages/en.json`, `messages/ru.json`).
 *
 * Server components, `generateMetadata` and server actions resolve their locale
 * from the request (never from a hard-coded value), and the English catalog
 * doubles as the fallback layer, so a missing translation shows real copy instead
 * of a key such as `hero.title`.
 */

const catalogs = { en, ru } as const;

function nodeAt(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function valueAt(source: unknown, path: string): string | undefined {
  const value = nodeAt(source, path);
  return typeof value === "string" ? value : undefined;
}

function interpolate(message: string, values?: Record<string, string | number>): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** English value of a message key, used as the fallback layer. */
export function fallbackMessage(namespace: string, key: string): string | undefined {
  return valueAt(en, `${namespace}.${key}`) ?? valueAt(en, key);
}

/** English message node (array/object) of a key, used as the fallback layer. */
export function fallbackNode(namespace: string, key: string): unknown {
  return nodeAt(en, `${namespace}.${key}`) ?? nodeAt(en, key);
}

/** Synchronous translator over the bundled catalogs for a known locale. */
export function createCatalogTranslator(locale: RequestLocale, namespace: string): MessageTranslator {
  const catalog = catalogs[locale];
  const translate = (key: string, values?: Record<string, string | number>) => {
    const message =
      valueAt(catalog, `${namespace}.${key}`) ??
      valueAt(en, `${namespace}.${key}`) ??
      valueAt(en, key) ??
      key;
    return interpolate(message, values);
  };
  translate.raw = (key: string) =>
    nodeAt(catalog, `${namespace}.${key}`) ?? fallbackNode(namespace, key);
  return translate;
}

/** True when the message exists in both catalogs (used by the catalog test). */
export function hasMessage(locale: RequestLocale, path: string): boolean {
  return valueAt(catalogs[locale], path) !== undefined;
}
