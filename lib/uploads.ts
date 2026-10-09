import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Dynamic covers live only in /public/uploads/<kind>/, never in /public/assets/. */
export type UploadKind = "services" | "blog";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const UPLOAD_FOLDERS: Record<UploadKind, string> = {
  services: path.join(UPLOAD_ROOT, "services"),
  blog: path.join(UPLOAD_ROOT, "blog"),
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string[]> = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".avif": ["image/avif"],
};

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

/** Save a validated cover and return the public URL stored in the DB. */
export async function saveCoverUpload(file: File, kind: UploadKind): Promise<string> {
  const folder = UPLOAD_FOLDERS[kind];
  if (!folder) throw new Error("Unknown upload destination.");

  const extension = path.extname(file.name || "").toLowerCase();
  const allowedMimeTypes = IMAGE_TYPES[extension];
  if (!allowedMimeTypes?.includes(file.type)) {
    throw new Error("Only PNG, JPEG, WebP, GIF and AVIF images can be uploaded.");
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be between 1 byte and 8 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !matchesImageSignature(bytes, extension)) {
    throw new Error("Invalid image file.");
  }

  const uniqueName = `${randomUUID()}${extension}`;
  const filePath = path.join(folder, uniqueName);
  await mkdir(folder, { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });
  return `/uploads/${kind}/${uniqueName}`;
}

/** Delete only a file produced by the uploader for the expected record kind. */
export async function deleteCoverUpload(publicPath: string, kind: UploadKind): Promise<void> {
  const folder = UPLOAD_FOLDERS[kind];
  if (!folder) throw new Error("Unknown upload destination.");
  const prefix = `/uploads/${kind}/`;
  if (!publicPath.startsWith(prefix)) return;

  const name = publicPath.slice(prefix.length);
  // Reject nested paths, traversal, query strings and arbitrary files such as README.md.
  if (!/^[0-9a-f-]{36}\.(png|jpe?g|webp|gif|avif)$/.test(name)) return;

  try {
    await unlink(path.join(folder, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
