// This module is safe to import in the browser; filesystem code stays in uploads.ts.
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
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
