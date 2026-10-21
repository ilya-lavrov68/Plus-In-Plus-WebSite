import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import {
  buildContentSecurityPolicy,
  createNonce,
  cspHeaderName,
  cspMode,
  defaultFrameAncestors,
  staticSecurityHeaders,
} from "@/lib/security-headers";
import { defaultLocale, isLocale, locales } from "@/i18n";

const production = process.env.NODE_ENV === "production";

const requestPathname = (request: { nextUrl?: { pathname?: string }; url?: string }) => {
  if (request.nextUrl?.pathname) return request.nextUrl.pathname;
  if (request.url) return new URL(request.url).pathname;
  return "/";
};

/**
 * Per-request security context: a fresh CSP nonce and the header it travels in.
 * Next.js copies the nonce of the incoming request's `content-security-policy` header onto
 * the inline scripts it renders, which is why the policy has to be set on the way in as well
 * as on the way out — with the same nonce.
 */
function securityContext() {
  const headerName = cspHeaderName(cspMode());
  const policy = headerName
    ? buildContentSecurityPolicy({
        nonce: createNonce(),
        production,
        frameAncestors: defaultFrameAncestors(production),
      })
    : null;
  return { headerName, policy };
}

function requestHeaders(request: Request, policy: string | null): Headers {
  const headers = new Headers(request.headers);
  if (policy) headers.set("content-security-policy", policy);
  return headers;
}

function secure<T extends NextResponse>(
  response: T,
  context: { headerName: string | null; policy: string | null },
): T {
  for (const [header, value] of Object.entries(staticSecurityHeaders(production))) {
    response.headers.set(header, value);
  }
  if (context.policy && context.headerName) response.headers.set(context.headerName, context.policy);
  return response;
}

/** Keeps whatever the auth middleware decided to send (cookies included), minus its internals. */
function carryOver(from: unknown, to: NextResponse): void {
  const headers = (from as { headers?: Headers } | null | undefined)?.headers;
  if (!headers) return;
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of cookies) to.headers.append("set-cookie", cookie);
  for (const [header, value] of headers.entries()) {
    const name = header.toLowerCase();
    if (name.startsWith("x-middleware-") || name === "set-cookie") continue;
    to.headers.set(header, value);
  }
}

const authMiddleware = NextAuth(authConfig).auth((request) => {
  const pathname = requestPathname(request);
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManagerArea = pathname === "/manager" || pathname.startsWith("/manager/");
  const isOrdersArea =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/cart" ||
    pathname.startsWith("/cart/");
  if (!isAdminArea && !isManagerArea && !isOrdersArea) return NextResponse.next();

  const role = request.auth?.user?.role;
  const signedIn = Boolean(isAuthConfigured() && request.auth?.user?.id);

  if (!signedIn) {
    return NextResponse.redirect(new URL(isOrdersArea ? "/login" : "/", request.url));
  }
  if (isOrdersArea) return NextResponse.next();
  if (role !== "FOUNDER" && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // Админка — администратору и основателю; менеджера ведём в его заявки.
  if (isAdminArea && role !== "FOUNDER" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/manager/orders", request.url));
  }
  return NextResponse.next();
});

export async function middleware(
  request: Parameters<typeof authMiddleware>[0],
  event: Parameters<typeof authMiddleware>[1],
) {
  const context = securityContext();
  const pathname = requestPathname(request);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManager = pathname === "/manager" || pathname.startsWith("/manager/");
  const isOrders =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/cart" ||
    pathname.startsWith("/cart/");

  if (isAdmin || isManager || isOrders) {
    const decision = await authMiddleware(request, event);
    // A redirect renders no document, so the nonce is irrelevant — pass the decision through.
    const location = (decision as NextResponse | undefined)?.headers?.get("location");
    if (location) return secure(decision as NextResponse, context);

    // Re-issue "continue" ourselves: only a response built here can forward the request
    // headers that carry the CSP nonce to the renderer.
    const response = NextResponse.next({ request: { headers: requestHeaders(request, context.policy) } });
    carryOver(decision, response);
    return secure(response, context);
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return secure(NextResponse.next({ request: { headers: requestHeaders(request, context.policy) } }), context);
  }
  if (pathname === "/_next" || pathname.startsWith("/_next/")) {
    return secure(NextResponse.next({ request: { headers: requestHeaders(request, context.policy) } }), context);
  }

  const segment = pathname.split("/")[1];
  if (isLocale(segment)) {
    const localizedPath = pathname.slice(segment.length + 1) || "/";
    if (localizedPath.startsWith("/admin") || localizedPath.startsWith("/manager")) {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = localizedPath;
      return secure(NextResponse.redirect(adminUrl), context);
    }
  }

  if (!isLocale(segment)) {
    const locale = preferredLocale(request);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname || "/";
    const headers = requestHeaders(request, context.policy);
    headers.set("x-pip-locale", locale);
    headers.set("X-NEXT-INTL-LOCALE", locale);
    return secure(NextResponse.rewrite(rewriteUrl, { request: { headers } }), context);
  }

  const internalPath = pathname.slice(segment.length + 1) || "/";
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = internalPath;
  const headers = requestHeaders(request, context.policy);
  headers.set("x-pip-locale", segment);
  headers.set("X-NEXT-INTL-LOCALE", segment);
  const response = secure(NextResponse.rewrite(rewriteUrl, { request: { headers } }), context);
  response.cookies.set("pip-locale", segment, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // A locale preference is not a secret, but a secure cookie cannot be read on a downgrade.
    secure: production,
  });
  return response;
}

function preferredLocale(request: Request): (typeof locales)[number] {
  const cookieLocale = request.headers.get("cookie")?.match(/(?:^|;\s*)pip-locale=(en|ru)(?:;|$)/)?.[1];
  if (isLocale(cookieLocale)) return cookieLocale;
  return defaultLocale;
}

export const config = {
  matcher: ["/((?!_next|api|uploads|.*\\..*).*)", "/admin/:path*"],
};
