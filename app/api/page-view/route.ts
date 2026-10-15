import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const DEVICES = new Set(["desktop", "mobile", "tablet"]);

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Запись просмотра. Вызывается с браузера, поэтому всему, что приходит,
 * доверять нельзя: обрезаем длину, проверяем путь и перечисления.
 */
export async function POST(request: Request) {
  if (!prisma) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({}));
    const path = clean(body?.path, 300) ?? "/";
    if (!path.startsWith("/")) return NextResponse.json({ ok: false }, { status: 400 });
    // Служебные части не считаем: там ходят сотрудники, а не посетители.
    if (path.startsWith("/admin") || path.startsWith("/manager") || path.startsWith("/api")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const device = clean(body?.device, 16);
    const view = await prisma.pageView.create({
      data: {
        path,
        referrer: clean(body?.referrer, 200),
        utmSource: clean(body?.utmSource, 100),
        // Чужие значения не пишем: перечисление из трёх значений.
        device: device && DEVICES.has(device) ? device : null,
        sessionId: clean(body?.sessionId, 100),
        visitorId: clean(body?.visitorId, 100),
      },
      select: { id: true },
    });
    // id нужен, чтобы позже дозаписать, сколько пробыли на странице.
    return NextResponse.json({ ok: true, id: view.id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

/**
 * Дозапись длительности. Отдельный запрос, а не обновление существующей
 * записи: сколько человек пробыл на странице, становится известно только
 * когда он с неё уходит.
 */
export async function PATCH(request: Request) {
  if (!prisma) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = clean(body?.id, 100);
    const durationMs = Number(body?.durationMs);
    if (!id || !Number.isFinite(durationMs) || durationMs < 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await prisma.pageView.updateMany({
      where: { id, durationMs: null },
      data: { durationMs: Math.min(Math.round(durationMs), 3_600_000) },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
