import { NextResponse } from "next/server";

import { getPayloadClient } from "@/lib/payload-native";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-origin";

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

async function pageViewRateLimit(request: Request, scope: string) {
  const key = hashRateLimitIdentifier(`page-view:${scope}:${requestAddress(request)}`);
  return checkRateLimitAsync(key, ADDRESS_LIMIT, WINDOW_MS);
}

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Запись просмотра. Вызывается с браузера, поэтому всему, что приходит,
 * доверять нельзя: обрезаем длину, проверяем путь и перечисления.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const limit = await pageViewRateLimit(request, "post");
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) });
  try {
    const result = await readJsonBody(request, MAX_BODY_BYTES);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    if (!isJsonObject(result.value)) return NextResponse.json({ ok: false }, { status: 400 });
    const body = result.value;
    if (body.analyticsConsent !== true) {
      return NextResponse.json({ ok: false, error: "Analytics consent required" }, { status: 403 });
    }
    const path = clean(body?.path, 300) ?? "/";
    if (!path.startsWith("/")) return NextResponse.json({ ok: false }, { status: 400 });
    // Служебные части не считаем: там ходят сотрудники, а не посетители.
    if (path.startsWith("/admin") || path.startsWith("/manager") || path.startsWith("/api")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const device = clean(body?.device, 16);
    const payload = await getPayloadClient();
    const view = await payload.create({
      collection: "page-views",
      data: {
        path,
        referrer: clean(body?.referrer, 200),
        utmSource: clean(body?.utmSource, 100),
        device: device && DEVICES.has(device) ? device : null,
        sessionId: clean(body?.sessionId, 100),
        visitorId: clean(body?.visitorId, 100),
      },
      overrideAccess: true,
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
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const limit = await pageViewRateLimit(request, "patch");
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) });
  try {
    const result = await readJsonBody(request, MAX_BODY_BYTES);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    if (!isJsonObject(result.value)) return NextResponse.json({ ok: false }, { status: 400 });
    const body = result.value;
    if (body.analyticsConsent !== true) {
      return NextResponse.json({ ok: false, error: "Analytics consent required" }, { status: 403 });
    }
    const id = clean(body?.id, 100);
    const durationMs = Number(body?.durationMs);
    if (!id || !Number.isFinite(durationMs) || durationMs < 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const payload = await getPayloadClient();
    await payload.update({
      collection: "page-views",
      data: { durationMs: Math.min(Math.round(durationMs), 3_600_000) },
      overrideAccess: true,
      where: { and: [{ id: { equals: id } }, { durationMs: { exists: false } }] },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
