import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";

/**
 * Guards every /admin/* route: the request is redirected to the landing page
 * unless it carries a session whose role is ADMIN.
 *
 * The configuration comes from auth.config.ts (JWT decoding only) because the
 * middleware bundle must not pull in Prisma or bcrypt; `@/auth` adds the
 * database-backed Credentials provider and is only used by Node runtimes.
 * Pages, data helpers and server actions re-verify the role against the DB.
 */
export const middleware = NextAuth(authConfig).auth((request) => {
  if (!isAuthConfigured() || !request.auth?.user?.id || request.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
});

// Node middleware is stable in Next 15.5 and supports Auth.js v5's JOSE runtime.
// Only /admin/* is matched: public pages and the Auth.js API stay untouched.
export const config = { matcher: ["/admin/:path*"], runtime: "nodejs" };
