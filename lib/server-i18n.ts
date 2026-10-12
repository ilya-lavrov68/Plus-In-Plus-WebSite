import { getTranslations } from "next-intl/server";

import {
  createCatalogTranslator,
  fallbackMessage,
  fallbackNode,
  type MessageTranslator,
} from "@/lib/i18n-messages";
import { getRequestLocale, type RequestLocale } from "@/lib/request-locale";

export type { MessageTranslator } from "@/lib/i18n-messages";

/**
 * Translations for the current request: pages, server components and
 * `generateMetadata`.
 *
 * The locale comes from the request itself — the `X-NEXT-INTL-LOCALE` header that
 * middleware.ts sends for locale-prefixed public URLs, or the `pip-locale` cookie
 * for the un-prefixed admin routes (`lib/request-locale.ts`). The messages are the
 * same `messages/*.json` catalogs the client provider receives, so server-rendered
 * markup and client components always agree, and a message that has no translation
 * yet falls back to the English catalog instead of printing a key.
 */
export async function getRequestTranslations(namespace: string): Promise<MessageTranslator> {
  const locale = await getRequestLocale();

  try {
    const t = await getTranslations({ locale, namespace });
    const translate = (key: string, values?: Record<string, string | number>) => {
      try {
        const message = t(key, values as never);
        // next-intl returns the key path when a message is missing for this locale.
        if (message === key || message === `${namespace}.${key}`) {
          return fallbackMessage(namespace, key) ?? message;
        }
        return message;
      } catch {
        return fallbackMessage(namespace, key) ?? key;
      }
    };
    translate.raw = (key: string) => {
      try {
        return t.raw(key);
      } catch {
        return fallbackNode(namespace, key);
      }
    };
    return translate;
  } catch {
    // No next-intl request scope (isolated tests, build tooling): the bundled
    // catalogs resolve exactly the same messages.
    return createCatalogTranslator(locale, namespace);
  }
}

/** Locale-aware namespace access when the locale is already known. */
export function getCatalogTranslator(locale: RequestLocale, namespace: string): MessageTranslator {
  return createCatalogTranslator(locale, namespace);
}
