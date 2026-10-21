import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-session";
import { checkRateLimit, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { fetchPublicText, UnsafeTargetError } from "@/lib/ssrf-guard";

const allowedSources = new Set(["vk", "telegram", "youtube"]);
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Preview of an external post: title and description for the blog form.
 *
 * The address is typed by an administrator, but the request is made by the server, so it goes
 * through the SSRF guard (lib/ssrf-guard.ts): no loopback, private, link-local or metadata
 * addresses, standard ports only, redirects re-validated, body capped. A limit per
 * administrator keeps a stolen session from being used to scan hosts.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!checkRateLimit(hashRateLimitIdentifier(`import-source:${admin.id}`), 20, WINDOW_MS).allowed) {
    return NextResponse.json({ error: "Too many import attempts. Try again later." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const source = typeof body?.source === "string" ? body.source.toLowerCase() : "";
    const value = typeof body?.url === "string" ? body.url.trim() : "";
    if (!allowedSources.has(source) || !value || value.length > 2000) {
      return NextResponse.json({ error: "Choose a source and URL." }, { status: 400 });
    }

    const html = await fetchPublicText(value, { userAgent: "PlusInPlus import preview" });
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
      ?? html.match(/<title[^>]*>([^<]+)/i)?.[1]
      ?? `${source.toUpperCase()} import`;
    const description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
    return NextResponse.json({ source, sourceUrl: value, title: title.trim().slice(0, 160), description: description.trim().slice(0, 500) });
  } catch (error) {
    if (error instanceof UnsafeTargetError) {
      console.warn(`[import-source] Blocked by the SSRF guard: ${error.message}`);
      return NextResponse.json({ error: "This address cannot be imported: only public http(s) pages are allowed." }, { status: 400 });
    }
    return NextResponse.json({ error: "The source could not be parsed. Check the URL or configure its API key in Settings." }, { status: 422 });
  }
}
