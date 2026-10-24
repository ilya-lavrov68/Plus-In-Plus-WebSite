export const SERVICE_COVER_PLACEHOLDER = "/assets/placeholders/service-cover.svg";
export const POST_COVER_PLACEHOLDER = "/assets/placeholders/post-cover.svg";
export const PRODUCT_COVER_PLACEHOLDER = SERVICE_COVER_PLACEHOLDER;

/** Retired third-party mockups must not reappear through old seed/database rows. */
export function isRetiredStockMockup(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith("/assets/shop/"));
}

function coverOrPlaceholder(
  value: string | null | undefined,
  placeholder: string,
): string {
  const cover = value?.trim();
  if (!cover || isRetiredStockMockup(cover) || cover.endsWith(".svg")) {
    return placeholder;
  }
  return cover;
}

export function serviceCover(value: string | null | undefined): string {
  return coverOrPlaceholder(value, SERVICE_COVER_PLACEHOLDER);
}

export function postCover(value: string | null | undefined): string {
  return coverOrPlaceholder(value, POST_COVER_PLACEHOLDER);
}

export function productCover(value: string | null | undefined): string {
  return coverOrPlaceholder(value, PRODUCT_COVER_PLACEHOLDER);
}
