import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { getPayloadClient } from "@/lib/payload-native";
import {
  isUploadFilename, isUploadKind, MAX_AVATAR_BYTES, MAX_COVER_BYTES,
  MAX_COVER_INPUT_PIXELS, MAX_COVER_OUTPUT_EDGE_PX, type UploadKind,
} from "@/lib/upload-policy";

export type { UploadKind } from "@/lib/upload-policy";

export class UploadValidationError extends Error {}

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
};

export function uploadDirectory(kind: UploadKind): string {
  if (!isUploadKind(kind)) throw new UploadValidationError("Unknown upload destination.");
  return path.join(process.cwd(), "public", "uploads", kind);
}

export function uploadMimeType(filename: string): string {
  return IMAGE_TYPES[path.extname(filename)] ?? "application/octet-stream";
}

function matchesImageSignature(bytes: Buffer, extension: string): boolean {
  switch (extension) {
    case ".png":
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case ".jpg":
    case ".jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case ".webp":
      return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case ".gif":
      return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    case ".avif":
      return bytes.toString("ascii", 4, 8) === "ftyp" &&
        ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
    default:
      return false;
  }
}

async function processImage(file: File, kind: UploadKind): Promise<Buffer> {
  const extension = path.extname(file.name || "").toLowerCase();
  if (!IMAGE_TYPES[extension] || IMAGE_TYPES[extension] !== file.type) {
    throw new UploadValidationError("Only PNG, JPEG, WebP, GIF and AVIF images can be uploaded.");
  }
  const limit = kind === "avatars" ? MAX_AVATAR_BYTES : MAX_COVER_BYTES;
  if (!file.size || file.size > limit) {
    throw new UploadValidationError(`Image must be between 1 byte and ${limit / 1024 / 1024} MB.`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !matchesImageSignature(bytes, extension)) {
    throw new UploadValidationError("Invalid image file.");
  }
  try {
    const size = kind === "avatars" ? 256 : MAX_COVER_OUTPUT_EDGE_PX;
    const image = await sharp(bytes, { limitInputPixels: MAX_COVER_INPUT_PIXELS, animated: false })
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    if (image.length > limit) throw new Error("processed image too large");
    return image;
  } catch {
    throw new UploadValidationError(`Invalid image file. Please choose a valid image under ${MAX_COVER_INPUT_PIXELS / 1_000_000} megapixels.`);
  }
}

async function createMedia(image: Buffer, kind: UploadKind): Promise<string> {
  const payload = await getPayloadClient();
  const media = await payload.create({
    collection: "media",
    data: { alt: kind === "avatars" ? "User avatar" : "Plus In Plus image", kind },
    file: {
      data: image,
      mimetype: "image/webp",
      name: `${randomUUID()}.webp`,
      size: image.length,
    },
    overrideAccess: true,
  });
  if (!media.url) throw new UploadValidationError("Payload did not return a media URL.");
  return media.url;
}

/** Validate, strip metadata and store a local raster image through Payload Media. */
export async function saveImageUpload(file: File, kind: UploadKind): Promise<string> {
  if (!isUploadKind(kind)) throw new UploadValidationError("Unknown upload destination.");
  return createMedia(await processImage(file, kind), kind);
}

async function deletePayloadMedia(publicPath: string, kind: UploadKind): Promise<boolean> {
  if (!publicPath.startsWith("/uploads/media/")) return false;
  const filename = publicPath.slice("/uploads/media/".length);
  if (!/^[a-z0-9][a-z0-9._-]{0,240}$/i.test(filename)) return true;
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "media",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ filename: { equals: filename } }, { kind: { equals: kind } }] },
  });
  const media = result.docs[0];
  if (media) await payload.delete({ collection: "media", id: media.id, overrideAccess: true });
  return true;
}

/** Only delete uploader-owned files in the expected folder, never arbitrary paths. */
export async function deleteImageUpload(publicPath: string | null, kind: UploadKind): Promise<void> {
  if (!publicPath || !isUploadKind(kind)) return;
  if (await deletePayloadMedia(publicPath, kind)) return;

  // Legacy local-file cleanup. New writes always take the Payload branch above.
  const folder = uploadDirectory(kind);
  const prefix = `/uploads/${kind}/`;
  if (!publicPath.startsWith(prefix)) return;
  const name = publicPath.slice(prefix.length);
  if (!isUploadFilename(name)) return;
  try {
    await unlink(path.join(folder, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Cleanup is best-effort and must not turn a committed DB mutation into a failure. */
export async function cleanupUpload(publicPath: string | null, kind: UploadKind): Promise<void> {
  await deleteImageUpload(publicPath, kind).catch((error) => console.error("Upload cleanup failed:", error));
}

export async function saveAlbumImage(file: File): Promise<string> {
  return saveImageUpload(file, "blog");
}

export async function deleteAlbumImage(publicPath: string | null): Promise<void> {
  await deleteImageUpload(publicPath, "blog");
}

export const saveCoverUpload = saveImageUpload;
export const deleteCoverUpload = deleteImageUpload;
