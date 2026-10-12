import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

/** Validate and re-encode a local raster image; strip metadata and never accept SVG/URLs. */
export async function saveImageUpload(file: File, kind: UploadKind): Promise<string> {
  const folder = uploadDirectory(kind);
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

  let image: Buffer;
  try {
    const size = kind === "avatars" ? 256 : MAX_COVER_OUTPUT_EDGE_PX;
    image = await sharp(bytes, { limitInputPixels: MAX_COVER_INPUT_PIXELS, animated: false })
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new UploadValidationError(`Invalid image file. Please choose a valid image under ${MAX_COVER_INPUT_PIXELS / 1_000_000} megapixels.`);
  }

  if (image.length > limit) throw new UploadValidationError("The processed image is too large. Please choose a smaller image.");
  const name = `${randomUUID()}.webp`;
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, name), image, { flag: "wx" });
  return `/uploads/${kind}/${name}`;
}

/** Only delete uploader-owned files in the expected folder, never arbitrary paths. */
export async function deleteImageUpload(publicPath: string | null, kind: UploadKind): Promise<void> {
  const folder = uploadDirectory(kind);
  const prefix = `/uploads/${kind}/`;
  if (!publicPath?.startsWith(prefix)) return;
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

/** Validate and re-encode an album image; save to /public/uploads/blog/albums/. */
export async function saveAlbumImage(file: File): Promise<string> {
  const folder = path.join(process.cwd(), "public", "uploads", "blog", "albums");
  const extension = path.extname(file.name || "").toLowerCase();
  if (!IMAGE_TYPES[extension] || IMAGE_TYPES[extension] !== file.type) {
    throw new UploadValidationError("Only PNG, JPEG, WebP, GIF and AVIF images can be uploaded.");
  }
  const limit = MAX_COVER_BYTES;
  if (!file.size || file.size > limit) {
    throw new UploadValidationError(`Image must be between 1 byte and ${limit / 1024 / 1024} MB.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !matchesImageSignature(bytes, extension)) {
    throw new UploadValidationError("Invalid image file.");
  }

  let image: Buffer;
  try {
    image = await sharp(bytes, { limitInputPixels: MAX_COVER_INPUT_PIXELS, animated: false })
      .rotate()
      .resize({ width: MAX_COVER_OUTPUT_EDGE_PX, height: MAX_COVER_OUTPUT_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new UploadValidationError(`Invalid image file. Please choose a valid image under ${MAX_COVER_INPUT_PIXELS / 1_000_000} megapixels.`);
  }

  if (image.length > limit) throw new UploadValidationError("The processed image is too large. Please choose a smaller image.");
  const name = `${randomUUID()}.webp`;
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, name), image, { flag: "wx" });
  return `/uploads/blog/albums/${name}`;
}

export async function deleteAlbumImage(publicPath: string | null): Promise<void> {
  const folder = path.join(process.cwd(), "public", "uploads", "blog", "albums");
  const prefix = "/uploads/blog/albums/";
  if (!publicPath?.startsWith(prefix)) return;
  const name = publicPath.slice(prefix.length);
  if (!isUploadFilename(name)) return;
  try {
    await unlink(path.join(folder, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

// Compatibility with the original cover uploader API.
export const saveCoverUpload = saveImageUpload;
export const deleteCoverUpload = deleteImageUpload;
