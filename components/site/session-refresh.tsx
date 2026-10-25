"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { REFRESH_PRESENT_COOKIE } from "@/lib/session-policy";

function hasRefreshMarker(): boolean {
  return document.cookie.split(/;\s*/).includes(`${REFRESH_PRESENT_COOKIE}=1`);
}

function safeLocalPath(value: string | null): string | null {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

/** Keeps the 15-minute access token fresh without making refresh tokens visible to JS. */
export function SessionRefresh() {
  const { status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const inFlight = useRef(false);

  const refresh = useCallback(async (recovering: boolean) => {
    if (inFlight.current || !hasRefreshMarker()) return false;
    inFlight.current = true;
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      if (!response.ok) {
        await update().catch(() => null);
        return false;
      }
      const refreshed = await update().catch(() => null);
      if (!refreshed?.user) return false;
      if (recovering) {
        const callback = safeLocalPath(new URLSearchParams(window.location.search).get("callbackUrl"));
        if (pathname === "/login" && callback) router.replace(callback);
        else router.refresh();
      }
      return true;
    } catch {
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [pathname, router, update]);

  useEffect(() => {
    if (status === "unauthenticated") void refresh(true);
  }, [refresh, status]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, 10 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return null;
}
