import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, messages } from "@/i18n";
import { getRequestLocale } from "@/lib/request-locale";

/**
 * Request configuration of next-intl (wired up in next.config.mjs).
 *
 * Public locale URLs (`/en/...`, `/ru/...`) are rewritten to the un-prefixed
 * internal routes by middleware.ts, which sends the language in
 * `X-NEXT-INTL-LOCALE`; the admin panel has no locale prefix and relies on the
 * `pip-locale` cookie instead. Both paths end in `getRequestLocale()`, so server
 * components, `generateMetadata` and server actions always see the language the
 * visitor selected.
 *
 * Kept out of `i18n.ts` on purpose: that module is imported by client
 * components, and `next/headers` must never enter the browser bundle.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = (await requestLocale) ?? (await getRequestLocale());
  const locale = isLocale(requested) ? requested : defaultLocale;
  return { locale, messages: messages[locale] };
});
