"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_SESSION_KEY,
  ANALYTICS_VISITOR_KEY,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
} from "@/lib/analytics-consent";

const SESSION_TTL_MS = 30 * 60 * 1000;

/** Служебные части сайта в статистику не попадают — это не посетители. */
function isInternal(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/")
    || path === "/manager" || path.startsWith("/manager/")
    || path === "/api" || path.startsWith("/api/");
}

/** Random pseudonymous IDs are created only after analytics consent. */
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
      // A damaged record is simply regenerated.
    }
  }
  const value = crypto.randomUUID();
  storage.setItem(key, JSON.stringify({ value, at: now }));
  return value;
}

function detectDevice(): string {
  const width = window.innerWidth;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  if (width < 768) return "mobile";
  if (coarse && width < 1024) return "tablet";
  return "desktop";
}

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
  const startedAt = useRef<number>(0);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const update = () => setAnalyticsEnabled(hasAnalyticsConsent());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CONSENT_STORAGE_KEY) update();
    };
    update();
    window.addEventListener(CONSENT_CHANGED_EVENT, update);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    startedAt.current = Date.now();
    if (!analyticsEnabled || !pathname) return;
    const path = pathname.replace(/^\/(?:en|ru)(?=\/|$)/, "") || "/";
    if (isInternal(path)) return;

    let cancelled = false;
    let viewId: string | null = null;
    const createView = (value: unknown) =>
      fetch("/api/page-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(value as object), analyticsConsent: true }),
        keepalive: true,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { id?: string } | null) => data?.id ?? null)
        .catch(() => null);

    void (async () => {
      const id = await createView({
        path,
        referrer: referrerDomain(),
        utmSource: new URLSearchParams(window.location.search).get("utm_source"),
        device: detectDevice(),
        sessionId: readOrCreate(ANALYTICS_SESSION_KEY, window.sessionStorage, SESSION_TTL_MS),
        visitorId: readOrCreate(ANALYTICS_VISITOR_KEY, window.localStorage),
      });
      if (!cancelled) {
        viewId = id;
        startedAt.current = Date.now();
      }
    })();

    const onLeave = () => {
      if (!viewId || !hasAnalyticsConsent()) return;
      void fetch("/api/page-view", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: viewId,
          durationMs: Date.now() - startedAt.current,
          analyticsConsent: true,
        }),
        keepalive: true,
      }).catch(() => {});
      viewId = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      onLeave();
      viewId = null;
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname, analyticsEnabled]);

  return null;
}
