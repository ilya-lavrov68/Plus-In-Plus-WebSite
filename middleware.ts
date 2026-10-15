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

/**
 * Две служебные части сайта с разными правами.
 *
 * /admin   — только администратор: управление сайтом.
 * /manager — администратор и менеджер: работа с заявками.
 *
 * Менеджера, зашедшего в /admin, отправляем в его часть, а не на главную:
 * это его рабочее место, просто не с теми правами.
 */
const authMiddleware = NextAuth(authConfig).auth((request) => {
  const pathname = requestPathname(request);
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManagerArea = pathname === "/manager" || pathname.startsWith("/manager/");
  if (!isAdminArea && !isManagerArea) return NextResponse.next();

  const role = request.auth?.user?.role;
  const signedIn = Boolean(isAuthConfigured() && request.auth?.user?.id);
  if (!signedIn || role === "USER" || (role !== "ADMIN" && role !== "MANAGER")) {
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
  const pathname = requestPathname(request);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isManager = pathname === "/manager" || pathname.startsWith("/manager/");
  if (isAdmin || isManager) return authMiddleware(request, event);

  // Служебные адреса (API, статические файлы) не имеют языка и не должны
  // гонять браузер по редиректу ради префикса. Иначе каждый вызов — лишний
  // переход, а POST приходится повторять.
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
  // next-intl reads this header for `requestLocale`, the locale every server
  // component and `generateMetadata` of the rewritten page resolves.
  requestHeaders.set("X-NEXT-INTL-LOCALE", segment);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  response.cookies.set("pip-locale", segment, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|uploads|.*\\..*).*)", "/admin/:path*"],
};
