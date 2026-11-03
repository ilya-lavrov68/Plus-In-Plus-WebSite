import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { publicRequestUrl } from "@/lib/auth-request";
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
import { REFRESH_PRESENT_COOKIE } from "@/lib/session-policy";

const production = process.env.NODE_ENV === "production";

const requestPathname = (request: { nextUrl?: { pathname?: string }; url?: string }) => {
  if (request.nextUrl?.pathname) return request.nextUrl.pathname;
  if (request.url) return new URL(request.url).pathname;
  return "/";
};

function isProtectedPath(pathname: string): {
  isAdminArea: boolean;
  isManagerArea: boolean;
  isOrdersArea: boolean;
  isFounderSettings: boolean;
} {
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManagerArea = pathname === "/manager" || pathname.startsWith("/manager/");
  const isOrdersArea =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/cart" ||
    pathname.startsWith("/cart/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/");
  const isFounderSettings =
    pathname === "/admin/settings" || pathname.startsWith("/admin/settings/");
  return { isAdminArea, isManagerArea, isOrdersArea, isFounderSettings };
}

/**
 * Per-request security context: a fresh CSP nonce and the header it travels in.
 * Next.js copies the nonce of the incoming request's `content-security-policy` header onto
 * the inline scripts it renders, which is why the policy has to be set on the way in as well
 * as on the way out — with the same nonce.
 */
function securityContext() {
  const headerName = cspHeaderName(cspMode(undefined, production));
  const policy = headerName
    ? buildContentSecurityPolicy({
        nonce: createNonce(),
        production,
        frameAncestors: defaultFrameAncestors(production),
      })
    : null;
  return { headerName, policy };
}

function requestHeaders(
  request: { headers?: HeadersInit },
  policy: string | null,
  locale?: string
): Headers {
  const headers = new Headers(request.headers ?? undefined);
  if (policy) headers.set("content-security-policy", policy);
  if (locale) {
    headers.set("x-pip-locale", locale);
    headers.set("X-NEXT-INTL-LOCALE", locale);
  }
  return headers;
}

function secure<T extends NextResponse>(
  response: T,
  context: { headerName: string | null; policy: string | null }
): T {
  for (const [header, value] of Object.entries(staticSecurityHeaders(production))) {
    response.headers.set(header, value);
  }
  if (context.policy && context.headerName) {
    response.headers.set(context.headerName, context.policy);
  }
  return response;
}

/** Keeps whatever the auth middleware decided to send (cookies included), minus its internals. */
function carryOver(from: unknown, to: NextResponse): void {
  const headers = (from as { headers?: Headers } | null | undefined)?.headers;
  if (!headers) return;
  const cookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of cookies) to.headers.append("set-cookie", cookie);
  for (const [header, value] of headers.entries()) {
    const name = header.toLowerCase();
    if (name.startsWith("x-middleware-") || name === "set-cookie") continue;
    to.headers.set(header, value);
  }
}

const authMiddleware = NextAuth(authConfig).auth((request) => {
  const pathname = requestPathname(request);
  const { isAdminArea, isManagerArea, isOrdersArea } = isProtectedPath(pathname);
  if (!isAdminArea && !isManagerArea && !isOrdersArea) {
    return NextResponse.next();
  }

  const role = request.auth?.user?.role;
  const signedIn = Boolean(isAuthConfigured() && request.auth?.user?.id);
  const publicUrl = publicRequestUrl(request);

  if (!signedIn) {
    const mayRefresh = request.cookies?.get(REFRESH_PRESENT_COOKIE)?.value === "1";
    const target = new URL(isOrdersArea || mayRefresh || isAdminArea ? "/login" : "/", publicUrl);
    if (isAdminArea) target.searchParams.set("mode", "admin");
    if (mayRefresh || isAdminArea) {
      const requestedPath = `${pathname}${request.nextUrl?.search ?? ""}`;
      target.searchParams.set("callbackUrl", requestedPath);
    }
    return NextResponse.redirect(target);
  }
  if (isOrdersArea) return NextResponse.next();
  if (role !== "FOUNDER" && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/", publicUrl));
  }
  // /admin — единая staff-панель: менеджера ограничивают серверные guards
  // и правила доступа на самих страницах.
  return NextResponse.next();
});

export async function proxy(
  request: Parameters<typeof authMiddleware>[0],
  event: Parameters<typeof authMiddleware>[1]
) {
  const context = securityContext();
  const pathname = requestPathname(request);

  // Legacy staff URLs have one destination; no second admin application remains.
  if (pathname === "/admin/dashboard" || pathname === "/manager" || pathname.startsWith("/manager/")) {
    const targetUrl = publicRequestUrl(request);
    if (pathname === "/admin/dashboard") {
      targetUrl.pathname = "/admin";
    } else if (pathname.startsWith("/manager/orders")) {
      targetUrl.pathname = pathname.replace(/^\/manager\/orders/, "/admin/orders");
    } else if (pathname.startsWith("/manager/users")) {
      targetUrl.pathname = pathname.replace(/^\/manager\/users/, "/admin/accounts");
    } else {
      targetUrl.pathname = "/admin";
    }
    return secure(NextResponse.redirect(targetUrl), context);
  }

  // Prevent locale-prefixed bypasses of protected routes (/ru/admin/*, /en/orders, /ru/profile, etc.)
  // while persisting the requested language preference in the `pip-locale` cookie.
  const segment = pathname.split("/")[1];
  if (isLocale(segment)) {
    const stripped = pathname.slice(segment.length + 1) || "/";
    const strippedGuards = isProtectedPath(stripped);
    if (
      strippedGuards.isAdminArea ||
      strippedGuards.isManagerArea ||
      strippedGuards.isOrdersArea
    ) {
      const targetUrl = publicRequestUrl(request);
      targetUrl.pathname = stripped;
      const redirectResponse = secure(
        NextResponse.redirect(targetUrl),
        context
      );
      redirectResponse.cookies.set("pip-locale", segment, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: production,
      });
      return redirectResponse;
    }
  }

  const { isAdminArea, isManagerArea, isOrdersArea } = isProtectedPath(pathname);

  if (isAdminArea || isManagerArea || isOrdersArea) {
    const decision = await authMiddleware(request, event);
    const location = (decision as NextResponse | undefined)?.headers?.get(
      "location"
    );
    if (location) return secure(decision as NextResponse, context);

    const locale = preferredLocale(request);
    const response = NextResponse.next({
      request: { headers: requestHeaders(request, context.policy, locale) },
    });
    carryOver(decision, response);
    return secure(response, context);
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return secure(
      NextResponse.next({
        request: { headers: requestHeaders(request, context.policy) },
      }),
      context
    );
  }
  if (pathname === "/_next" || pathname.startsWith("/_next/")) {
    return secure(
      NextResponse.next({
        request: { headers: requestHeaders(request, context.policy) },
      }),
      context
    );
  }

  if (!isLocale(segment)) {
    const locale = preferredLocale(request);
    const rewriteUrl = request.nextUrl
      ? request.nextUrl.clone()
      : new URL(request.url);
    rewriteUrl.pathname = pathname || "/";
    const headers = requestHeaders(request, context.policy, locale);
    return secure(NextResponse.rewrite(rewriteUrl, { request: { headers } }), context);
  }

  const internalPath = pathname.slice(segment.length + 1) || "/";
  const rewriteUrl = request.nextUrl
    ? request.nextUrl.clone()
    : new URL(request.url);
  rewriteUrl.pathname = internalPath;
  const headers = requestHeaders(request, context.policy, segment);
  const response = secure(
    NextResponse.rewrite(rewriteUrl, { request: { headers } }),
    context
  );
  response.cookies.set("pip-locale", segment, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: production,
  });
  return response;
}

function preferredLocale(request: { headers?: { get?: (name: string) => string | null } }): (typeof locales)[number] {
  const cookieHeader =
    typeof request?.headers?.get === "function"
      ? request.headers.get("cookie")
      : null;
  const cookieLocale = cookieHeader?.match(/(?:^|;\s*)pip-locale=(en|ru)(?:;|$)/)?.[1];
  if (isLocale(cookieLocale)) return cookieLocale;
  return defaultLocale;
}

export const config = {
  // API routes need the same CSP, framing and MIME protections as pages. The
  // negative page matcher deliberately excludes /api, so list it explicitly.
  matcher: [
    "/((?!_next|api|uploads|.*\\..*).*)",
    "/api/:path*",
    "/admin/:path*",
  ],
};
