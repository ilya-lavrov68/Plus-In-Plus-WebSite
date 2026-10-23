import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-session";
import { checkRateLimit, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { saveAlbumImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FILES_PER_REQUEST = 20;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !checkRateLimit(
      hashRateLimitIdentifier(`upload-album:${admin.id}`),
      30,
      WINDOW_MS
    ).allowed
  ) {
    return NextResponse.json(
      { error: "Too many upload attempts. Try again later." },
      { status: 429 }
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
    console.error("Failed to upload album images:", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
