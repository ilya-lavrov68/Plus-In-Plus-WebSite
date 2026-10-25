import { AuthError } from "next-auth";
import { NextResponse } from "next/server";

import { signIn } from "@/auth";
import { clearRefreshCookies, readRefreshCookies } from "@/lib/auth-sessions";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
import { logServerError } from "@/lib/security-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  const address = getClientAddress(request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"));
  const limit = await checkRateLimitAsync(hashRateLimitIdentifier(`refresh:${address}`), 60, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, ...retryAfterHeaders(limit.retryAfterSeconds) } },
    );
  }

  const { refreshToken, deviceId } = await readRefreshCookies();
  if (!refreshToken || !deviceId) {
    await clearRefreshCookies();
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    await signIn("credentials", {
      refreshToken,
      deviceId,
      redirect: false,
      redirectTo: "/",
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    await clearRefreshCookies();
    if (!(error instanceof AuthError)) logServerError("auth.session.refresh_failed", error);
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
}
