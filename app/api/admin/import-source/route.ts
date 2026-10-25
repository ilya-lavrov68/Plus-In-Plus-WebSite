import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-session";
import { checkRateLimitAsync, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-origin";
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
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const limit = await checkRateLimitAsync(hashRateLimitIdentifier(`import-source:${admin.id}`), 20, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many import attempts. Try again later." },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }

  const result = await readJsonBody(request, 16 * 1024);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isJsonObject(result.value)) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  const body = result.value;

  try {
    const source = typeof body.source === "string" ? body.source.toLowerCase() : "";
    const value = typeof body.url === "string" ? body.url.trim() : "";
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
      return NextResponse.json({ error: "This address cannot be imported: only public http(s) pages are allowed." }, { status: 400 });
    }
    return NextResponse.json({ error: "The source could not be parsed. Check the URL or configure its API key in Settings." }, { status: 422 });
  }
}
