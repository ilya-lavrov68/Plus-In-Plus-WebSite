import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";

/** JWT gate; pages/data/actions also verify the current database role. */
export const middleware = NextAuth(authConfig).auth((request) => {
  if (!isAuthConfigured() || !request.auth?.user?.id || request.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
});

// Node middleware is stable in Next 15.5 and supports Auth.js v5's JOSE runtime.
export const config = { matcher: ["/admin/:path*"], runtime: "nodejs" };
