import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";

import { isUploadFilename, MAX_COVER_BYTES } from "@/lib/upload-policy";
import { uploadMimeType } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!isUploadFilename(filename)) return new Response(null, { status: 404 });

  let file;
  try {
    const filePath = path.join(process.cwd(), "public", "uploads", "blog", "albums", filename);
    file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
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
    console.error("Album upload read failed:", error);
    return new Response(null, { status: 500 });
  } finally {
    await file?.close();
  }
}
