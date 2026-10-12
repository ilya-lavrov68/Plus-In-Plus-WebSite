import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import { defaultLocale, isLocale, locales } from "@/i18n";

const authMiddleware = NextAuth(authConfig).auth((request) => {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  if (!isAuthConfigured() || !request.auth?.user?.id || request.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
});

function preferredLocale(request: Request): (typeof locales)[number] {
  const cookieLocale = request.headers.get("cookie")?.match(/(?:^|;\s*)pip-locale=(en|ru)(?:;|$)/)?.[1];
  if (isLocale(cookieLocale)) return cookieLocale;

  const language = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return language.split(",").some((entry) => entry.trim().startsWith("ru")) ? "ru" : defaultLocale;
}

/**
 * Public pages keep their existing App Router implementation while gaining
 * stable locale URLs. `/ru/blog` is rewritten internally to `/blog`, so the
 * browser URL and language selection survive client navigation without a
 * second copy of every public page.
 */
export function middleware(
  request: Parameters<typeof authMiddleware>[0],
  event: Parameters<typeof authMiddleware>[1],
) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdmin) return authMiddleware(request, event);

  const segment = pathname.split("/")[1];
  if (isLocale(segment)) {
    const localizedPath = pathname.slice(segment.length + 1) || "/";
    if (localizedPath === "/admin" || localizedPath.startsWith("/admin/")) {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = localizedPath;
      return NextResponse.redirect(adminUrl);
    }
  }

  if (!isLocale(segment)) {
    const locale = preferredLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("pip-locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  const internalPath = pathname.slice(segment.length + 1) || "/";
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = internalPath;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pip-locale", segment);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  response.cookies.set("pip-locale", segment, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|uploads|.*\\..*).*)", "/admin/:path*"],
};
