export const locales = ["en", "ru"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export const routing = {
  locales,
  defaultLocale,
  localePrefix: "as-needed" as const,
};

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "ru";
}

const UNPREFIXED_PREFIXES = [
  "/admin",
  "/manager",
  "/orders",
  "/cart",
  "/profile",
] as const;

export function isUnprefixedProtectedPath(pathname: string): boolean {
  return UNPREFIXED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Computes the destination path when switching between `en` and `ru`.
 *
 * Explicit `/en` and `/ru` prefixes are used when switching on public pages so
 * switching RU -> EN from an unprefixed URL (when `pip-locale=ru` cookie was
 * active) deterministically switches to `/en/...` and updates middleware/server
 * locale headers immediately in BOTH directions.
 *
 * Protected routes (`/admin/*`, `/manager/*`, `/orders*`, `/cart*`, `/profile*`)
 * remain unprefixed; language switching on them relies on updating `pip-locale`
 * cookie + `router.refresh()`.
 */
export function localizedPath(
  pathname: string,
  next: AppLocale,
  search = "",
  hash = ""
): string {
  const safePath = pathname && pathname.startsWith("/") ? pathname : "/";
  const firstSegment = safePath.split("/")[1];
  const stripped =
    firstSegment === "en" || firstSegment === "ru"
      ? safePath.slice(firstSegment.length + 1) || "/"
      : safePath;

  const queryPart = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  const hashPart = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";

  if (isUnprefixedProtectedPath(stripped)) {
    return `${stripped}${queryPart}${hashPart}`;
  }

  const base = stripped === "/" ? `/${next}` : `/${next}${stripped}`;
  return `${base}${queryPart}${hashPart}`;
}
