import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";

import { isMediaFilename, isUploadFilename, isUploadKind, MAX_COVER_BYTES } from "@/lib/upload-policy";
import { uploadMimeType } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Next's production public-file index is created at startup. Serve new uploads too. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; filename: string }> },
) {
  const { kind, filename } = await params;
  const media = kind === "media";
  if ((!media && !isUploadKind(kind)) || !(media ? isMediaFilename(filename) : isUploadFilename(filename))) {
    return new Response(null, { status: 404 });
  }

  let file;
  try {
    const directory = path.join(process.cwd(), "public", "uploads", kind);
    file = await open(path.join(directory, filename), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_COVER_BYTES) return new Response(null, { status: 404 });
    const bytes = await file.readFile();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": uploadMimeType(filename),
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ELOOP" || code === "ENOTDIR") return new Response(null, { status: 404 });
    console.error("Upload read failed:", error);
    return new Response(null, { status: 500 });
  } finally {
    await file?.close();
  }
}
