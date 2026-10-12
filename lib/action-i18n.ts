import { createCatalogTranslator, fallbackMessage } from "@/lib/i18n-messages";
import type { MessageTranslator } from "@/lib/i18n-messages";
import { getRequestLocale } from "@/lib/request-locale";

/**
 * Translator of the messages a server action returns to the interface
 * (`actions.*` in `messages/*.json`).
 *
 * Server actions run outside the rendering tree, so the locale is resolved from
 * the request itself (locale header, then the `pip-locale` cookie) and the text is
 * produced on the server in the language the visitor chose. Anything that cannot be
 * resolved falls back to the English catalog, so a key can never leak into a form.
 */
export async function getActionTranslator(): Promise<MessageTranslator> {
  const locale = await getRequestLocale();
  return createCatalogTranslator(locale, "actions");
}

/** English fallback of an action message, used by routes that have no request locale. */
export function actionMessage(key: string): string {
  return fallbackMessage("actions", key) ?? key;
}
