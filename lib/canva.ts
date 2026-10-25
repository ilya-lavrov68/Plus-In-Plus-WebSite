const CANVA_DESIGN_PATH =
  /^\/design\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?\/view\/?$/;

/**
 * Accept a Canva design view URL and turn it into the minimal embed URL.
 * Short links, credentials, other hosts and arbitrary Canva pages are refused.
 */
export function normalizeCanvaEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "www.canva.com" && hostname !== "canva.com") ||
      url.username ||
      url.password ||
      !CANVA_DESIGN_PATH.test(url.pathname)
    ) {
      return null;
    }

    url.hostname = "www.canva.com";
    url.search = "?embed";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
