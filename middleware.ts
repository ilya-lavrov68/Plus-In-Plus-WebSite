import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Protects every /admin/* route: a valid session with role === "ADMIN" is
 * required. Everyone else is sent back to the landing page with the auth
 * modal opened via ?auth=login.
 */
function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/", req.url);
  loginUrl.searchParams.set("auth", "login");
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    return redirectToLogin(req);
  }

  const token = await getToken({ req, secret });

  if (!token || token.role !== "ADMIN") {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
