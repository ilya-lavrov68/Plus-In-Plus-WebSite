import { NextResponse } from "next/server";

import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_TYPES = ["application/csp-report", "application/reports+json", "application/json"] as const;
const MAX_REPORT_BYTES = 16 * 1024;

function reportBodies(value: unknown): Record<string, unknown>[] {
  if (isJsonObject(value) && isJsonObject(value["csp-report"])) return [value["csp-report"]];
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((report) => {
    if (!isJsonObject(report) || !isJsonObject(report.body)) return [];
    return report.type === "csp-violation" || report.type === "content-security-policy"
      ? [report.body]
      : [];
  });
}

export async function POST(request: Request): Promise<Response> {
  const address = getClientAddress(request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"));
  const limit = await checkRateLimitAsync(hashRateLimitIdentifier(`csp-report:${address}`), 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }
  const result = await readJsonBody(request, MAX_REPORT_BYTES, REPORT_TYPES);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "invalid_report" }, { status: result.status });
  }
  const bodies = reportBodies(result.value);
  if (!bodies.length) {
    return NextResponse.json({ ok: false, error: "invalid_report" }, { status: 400 });
  }
  for (const body of bodies) {
    const rawDirective = body["effective-directive"]
      ?? body["effectiveDirective"]
      ?? body["violated-directive"]
      ?? body["violatedDirective"];
    const directive = typeof rawDirective === "string" ? rawDirective.split(/[\s;]/, 1)[0] : undefined;
    // Never log documentURI, blockedURI, source-file, line numbers, samples,
    // cookies, IP or user agent: reports can contain personal or secret URLs.
    logSecurityEvent("security.csp.violation", { directive });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
