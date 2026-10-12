import { cookies, headers } from "next/headers";

export type RequestLocale = "en" | "ru";

const LOCALE_COOKIE = "pip-locale";

function isRequestLocale(value: string | undefined | null): value is RequestLocale {
  return value === "en" || value === "ru";
}

/**
 * Locale of the current request.
 *
 * 1. `x-pip-locale` — set by middleware.ts for every locale-prefixed public URL
 *    (`/ru/...`), so the rewritten internal route keeps knowing its language.
 * 2. `pip-locale` cookie — written by the language switcher and by the
 *    middleware. Admin routes have no locale prefix, so the cookie is what keeps
 *    the admin panel in the language the visitor picked on the public site.
 * 3. English, the default locale.
 *
 * Safe in server requests and in isolated component tests without a request store.
 */
export async function getRequestLocale(): Promise<RequestLocale> {
  try {
    const headerLocale = (await headers()).get("x-pip-locale");
    if (isRequestLocale(headerLocale)) return headerLocale;

    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isRequestLocale(cookieLocale)) return cookieLocale;

    return "en";
  } catch {
    return "en";
  }
}
