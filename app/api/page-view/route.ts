import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!prisma) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "/";
    if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return NextResponse.json({ ok: false }, { status: 400 });
    await prisma.pageView.create({ data: { path } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
