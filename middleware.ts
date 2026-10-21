import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import { defaultLocale, isLocale, locales } from "@/i18n";

const requestPathname = (request: { nextUrl?: { pathname?: string }; url?: string }) => {
  if (request.nextUrl?.pathname) return request.nextUrl.pathname;
  if (request.url) return new URL(request.url).pathname;
  return "/";
};

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
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isAdminArea && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/manager/orders", request.url));
  }
  return NextResponse.next();
});

function preferredLocale(request: Request): (typeof locales)[number] {
  const cookieLocale = request.headers.get("cookie")?.match(/(?:^|;\s*)pip-locale=(en|ru)(?:;|$)/)?.[1];
  if (isLocale(cookieLocale)) return cookieLocale;
  return defaultLocale;
}

export function middleware(
  request: Parameters<typeof authMiddleware>[0],
  event: Parameters<typeof authMiddleware>[1],
) {
  const pathname = requestPathname(request);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManager = pathname === "/manager" || pathname.startsWith("/manager/");
  const isOrders =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/cart" ||
    pathname.startsWith("/cart/");
  if (isAdmin || isManager || isOrders) return authMiddleware(request, event);

  if (pathname === "/api" || pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname === "/_next" || pathname.startsWith("/_next/")) return NextResponse.next();

  const segment = pathname.split("/")[1];
  if (isLocale(segment)) {
    const localizedPath = pathname.slice(segment.length + 1) || "/";
    if (localizedPath.startsWith("/admin") || localizedPath.startsWith("/manager")) {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = localizedPath;
      return NextResponse.redirect(adminUrl);
    }
  }

  if (!isLocale(segment)) {
    const locale = preferredLocale(request);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname || "/";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pip-locale", locale);
    requestHeaders.set("X-NEXT-INTL-LOCALE", locale);
    return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  }

  const internalPath = pathname.slice(segment.length + 1) || "/";
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = internalPath;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pip-locale", segment);
  requestHeaders.set("X-NEXT-INTL-LOCALE", segment);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  response.cookies.set("pip-locale", segment, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|uploads|.*\\..*).*)", "/admin/:path*"],
};
