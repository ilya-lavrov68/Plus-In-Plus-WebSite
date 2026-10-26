import { NextRequest } from "next/server";

type RequestUrlSource = {
  url: string;
  headers?: HeadersInit;
  nextUrl?: {
    pathname: string;
    search: string;
    protocol?: string;
    host?: string;
  };
};

/**
 * Next's Node server can expose its bind address in request.url behind a proxy.
 * Preserve the trusted public origin for authentication callbacks and redirects.
 * The deployment proxy MUST overwrite forwarding headers (see README).
 */
export function publicRequestUrl(request: RequestUrlSource): URL {
  const sourceUrl = new URL(request.url);
  const headers = new Headers(request.headers);
  const hostHeader = request.headers
    ? headers.get("x-forwarded-host") ?? headers.get("host")
    : null;
  const protocolHeader = request.headers
    ? headers.get("x-forwarded-proto")
    : null;
  const host = hostHeader?.split(",", 1)[0]?.trim()
    ?? request.nextUrl?.host
    ?? sourceUrl.host;
  const protocol = protocolHeader?.split(",", 1)[0]?.trim()
    ?? request.nextUrl?.protocol?.slice(0, -1)
    ?? sourceUrl.protocol.slice(0, -1);
  if (!/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(host) || !["http", "https"].includes(protocol)) {
    throw new Error("Invalid authentication origin.");
  }
  const publicUrl = new URL(`${protocol}://${host}`);
  publicUrl.pathname = request.nextUrl?.pathname ?? sourceUrl.pathname;
  publicUrl.search = request.nextUrl?.search ?? sourceUrl.search;
  return publicUrl;
}

/** Give Auth.js a request whose URL matches the public origin without losing its body. */
export function authRequest(request: NextRequest): NextRequest {
  return new NextRequest(publicRequestUrl(request), request);
}
