import { NextRequest } from "next/server";

/**
 * Next's Node server can expose its bind address in request.url behind a proxy.
 * Auth.js builds callback URLs from that URL, so preserve the trusted public origin.
 * The deployment proxy MUST overwrite forwarding headers (see README).
 */
export function authRequest(request: NextRequest): NextRequest {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",", 1)[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim() ?? request.nextUrl.protocol.slice(0, -1);
  if (!host || !/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(host) || !["http", "https"].includes(protocol)) {
    throw new Error("Invalid authentication origin.");
  }
  const publicUrl = new URL(`${protocol}://${host}`);
  publicUrl.pathname = request.nextUrl.pathname;
  publicUrl.search = request.nextUrl.search;
  return new NextRequest(publicUrl, request);
}
