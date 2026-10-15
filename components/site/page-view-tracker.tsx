"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "pip-sid";
const VISITOR_KEY = "pip-vid";
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Служебные части сайта в статистику не попадают — это не посетители. */
function isInternal(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/")
    || path === "/manager" || path.startsWith("/manager/")
    || path === "/api" || path.startsWith("/api/");
}

/**
 * Идентификаторы — случайные, без привязки к аккаунту.
 *
 * visitorId живёт год и позволяет считать уникальных посетителей, sessionId
 * живёт полчаса и склеивает переходы одного визита. Ни то, ни другое не
 * позволяет опознать человека: это случайные строки, а не почта или id.
 */
function readOrCreate(key: string, storage: Storage, maxAgeMs?: number): string {
  const raw = storage.getItem(key);
  const now = Date.now();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { value?: string; at?: number };
      if (parsed?.value && (!maxAgeMs || !parsed.at || now - parsed.at < maxAgeMs)) {
        return parsed.value;
      }
    } catch {
      // Испорченная запись — просто перегенерируем.
    }
  }
  const value = crypto.randomUUID();
  storage.setItem(key, JSON.stringify({ value, at: now }));
  return value;
}

/** Крупное зерно: надо понимать долю мобильных, а не модель телефона. */
function detectDevice(): string {
  const width = window.innerWidth;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  if (width < 768) return "mobile";
  if (coarse && width < 1024) return "tablet";
  return "desktop";
}

/** Домен источника. Полный адрес хранить незачем — и так понятно, откуда. */
function referrerDomain(): string | null {
  const referrer = document.referrer;
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.host === window.location.host) return null;
    return url.host;
  } catch {
    return null;
  }
}

export function PageViewTracker() {
  const pathname = usePathname();
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    if (!pathname) return;
    const path = pathname.replace(/^\/(?:en|ru)(?=\/|$)/, "") || "/";
    if (isInternal(path)) return;

    const json = (value: unknown) =>
      fetch("/api/page-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
        keepalive: true,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { id?: string } | null) => data?.id ?? null)
        .catch(() => null);

    // Сначала записываем сам визит, потом по его id — сколько пробыли.
    // Раздельно потому, что длительность известна только на уходе.
    let viewId: string | null = null;
    void (async () => {
      viewId = await json({
        path,
        referrer: referrerDomain(),
        utmSource: new URLSearchParams(window.location.search).get("utm_source"),
        device: detectDevice(),
        sessionId: readOrCreate(SESSION_KEY, window.sessionStorage, SESSION_TTL_MS),
        visitorId: readOrCreate(VISITOR_KEY, window.localStorage),
      });
      startedAt.current = Date.now();
    })();

    const onLeave = () => {
      if (!viewId) return;
      void fetch("/api/page-view", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: viewId, durationMs: Date.now() - startedAt.current }),
        keepalive: true,
      }).catch(() => {});
      // Повторный уход со страницы не должен слать ещё один запрос.
      viewId = null;
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onLeave();
    });
    return () => {
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
    };
  }, [pathname]);

  return null;
}
