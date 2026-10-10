import { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { authRequest } from "@/lib/auth-request";

export const runtime = "nodejs";

function handle(request: NextRequest, handler: (request: NextRequest) => Promise<Response>) {
  let normalized: NextRequest;
  try {
    normalized = authRequest(request);
  } catch {
    return new Response("Invalid authentication origin.", { status: 400 });
  }
  return handler(normalized);
}

export function GET(request: NextRequest) {
  return handle(request, handlers.GET);
}

export function POST(request: NextRequest) {
  return handle(request, handlers.POST);
}
