import type { ServiceView } from "@/lib/data";

/** Artwork cropped directly from the supplied Shop/Shop Service SVG mockups. */
export const SHOP_SERVICE_ARTWORK: Record<string, string> = {
  "sign-design": "/assets/shop/sign-design.jpg",
  "bag-design": "/assets/shop/bag-design.jpg",
  "outdoor-glass-poster": "/assets/shop/outdoor-glass-poster.jpg",
  "banner-design": "/assets/shop/banner-design.jpg",
  "large-billboard-on-a-building": "/assets/shop/large-billboard-building.jpg",
  "large-billboard-building": "/assets/shop/large-billboard-building.jpg",
  "rooftop-advertising": "/assets/shop/rooftop-advertising.jpg",
  "advertisement-on-the-fence": "/assets/shop/advertisement-on-the-fence.jpg",
  "advertisement-fence": "/assets/shop/advertisement-on-the-fence.jpg",
  billboard: "/assets/shop/billboard.jpg",
};

const SIGN_DESIGN_GALLERY = [
  "/assets/shop/sign-design.jpg",
  "/assets/shop/sign-design-2.jpg",
  "/assets/shop/sign-design-3.jpg",
  "/assets/shop/sign-design-4.jpg",
] as const;

function normalizedServiceKeys(service: Pick<ServiceView, "title" | "slug">) {
  return [service.slug, service.title]
    .map((value) => (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
}

export function isSignDesignService(service: Pick<ServiceView, "title" | "slug">) {
  return normalizedServiceKeys(service).includes("sign-design");
}

/** Use the supplied mockup artwork for named reference services; otherwise retain the DB cover. */
export function getServiceArtwork(service: Pick<ServiceView, "title" | "slug" | "coverImage">) {
  const key = normalizedServiceKeys(service).find((value) => SHOP_SERVICE_ARTWORK[value]);
  return (key ? SHOP_SERVICE_ARTWORK[key] : null) ?? service.coverImage?.trim() ?? "";
}

/** The reference sign service has four mockup photos; other DB services use their cover. */
export function getServiceGallery(service: Pick<ServiceView, "title" | "slug" | "coverImage">) {
  if (isSignDesignService(service)) return [...SIGN_DESIGN_GALLERY];
  const cover = service.coverImage?.trim();
  return cover ? [cover] : [];
}
