// This module is safe to import in the browser; filesystem code stays in uploads.ts.
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export const MAX_COVER_INPUT_PIXELS = 25_000_000;
export const MAX_COVER_OUTPUT_EDGE_PX = 2400;

/**
 * Recommended cover exports match the 4:3 post/service detail frame. Public
 * thumbnails and galleries scale other image ratios to fit instead of cropping.
 */
export const COVER_IMAGE_GUIDES = {
  blog: {
    aspectRatio: "4:3",
    minimum: "800 × 600 px",
    recommended: "1,600 × 1,200 px",
    maximumAfterProcessing: "2,400 × 1,800 px",
  },
  services: {
    aspectRatio: "4:3",
    minimum: "800 × 600 px",
    recommended: "1,600 × 1,200 px",
    maximumAfterProcessing: "2,400 × 1,800 px",
  },
} as const;

export const UPLOAD_KINDS = ["avatars", "services", "blog"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

export function isUploadFilename(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif|avif)$/.test(value);
}

/** Never request external avatars, including URLs manually placed in the DB. */
export function localAvatarPath(value: unknown): string | null {
  const prefix = "/uploads/avatars/";
  return typeof value === "string" && value.startsWith(prefix) &&
    isUploadFilename(value.slice(prefix.length)) ? value : null;
}
