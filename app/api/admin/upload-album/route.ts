import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-session";
import { checkRateLimitAsync, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
import { logServerError } from "@/lib/security-log";
import { saveAlbumImage, UploadValidationError } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FILES_PER_REQUEST = 20;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkRateLimitAsync(
    hashRateLimitIdentifier(`upload-album:${admin.id}`),
    30,
    WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many upload attempts. Try again later." },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
      const single = formData.get("file");
      if (single instanceof File && single.size > 0) {
        files.push(single);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_REQUEST} files per upload.` },
        { status: 400 }
      );
    }

    const urls: string[] = [];
    for (const file of files) {
      const url = await saveAlbumImage(file);
      urls.push(url);
    }

    return NextResponse.json({ ok: true, urls });
  } catch (error) {
    logServerError("admin.upload_album_failed", error);
    const message = error instanceof UploadValidationError ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
