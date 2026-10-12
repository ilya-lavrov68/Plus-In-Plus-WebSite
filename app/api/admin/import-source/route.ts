import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-session";

const allowedSources = new Set(["vk", "telegram", "youtube"]);

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json();
    const source = typeof body?.source === "string" ? body.source.toLowerCase() : "";
    const value = typeof body?.url === "string" ? body.url.trim() : "";
    if (!allowedSources.has(source) || !value) return NextResponse.json({ error: "Choose a source and URL." }, { status: 400 });
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid protocol");
    const response = await fetch(url, { headers: { "user-agent": "PlusInPlus import preview" }, signal: AbortSignal.timeout(5000) });
    const html = response.ok ? await response.text() : "";
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
      ?? html.match(/<title[^>]*>([^<]+)/i)?.[1]
      ?? `${source.toUpperCase()} import`;
    const description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
    return NextResponse.json({ source, sourceUrl: value, title: title.trim().slice(0, 160), description: description.trim().slice(0, 500) });
  } catch {
    return NextResponse.json({ error: "The source could not be parsed. Check the URL or configure its API key in Settings." }, { status: 422 });
  }
}
