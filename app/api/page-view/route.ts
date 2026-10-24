import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier } from "@/lib/rate-limit";

const DEVICES = new Set(["desktop", "mobile", "tablet"]);
const WINDOW_MS = 10 * 60 * 1000;
/**
 * Аналитика пишется с браузера без входа, поэтому её можно накрутить — и заодно раздуть
 * таблицу page_views. Предел щедрый: за офисным NAT спокойно сидит несколько десятков
 * людей, а вот скрипт, пишущий по 100 строк в секунду, упирается сразу.
 */
const ADDRESS_LIMIT = 600;
const MAX_BODY_BYTES = 8 * 1024;

function requestAddress(request: Request): string {
  return getClientAddress(request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"));
}

async function limitExceeded(request: Request, scope: string): Promise<boolean> {
  const key = hashRateLimitIdentifier(`page-view:${scope}:${requestAddress(request)}`);
  return !(await checkRateLimitAsync(key, ADDRESS_LIMIT, WINDOW_MS)).allowed;
}

function payloadTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Запись просмотра. Вызывается с браузера, поэтому всему, что приходит,
 * доверять нельзя: обрезаем длину, проверяем путь и перечисления.
 */
export async function POST(request: Request) {
  if (!prisma) return NextResponse.json({ ok: false }, { status: 503 });
  if (await limitExceeded(request, "post")) return NextResponse.json({ ok: false }, { status: 429 });
  if (payloadTooLarge(request)) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.analyticsConsent !== true) {
      return NextResponse.json({ ok: false, error: "Analytics consent required" }, { status: 403 });
    }
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
  if (await limitExceeded(request, "patch")) return NextResponse.json({ ok: false }, { status: 429 });
  if (payloadTooLarge(request)) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.analyticsConsent !== true) {
      return NextResponse.json({ ok: false, error: "Analytics consent required" }, { status: 403 });
    }
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
