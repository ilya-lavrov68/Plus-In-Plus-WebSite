"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    const path = pathname.replace(/^\/(?:en|ru)(?=\/|$)/, "") || "/";
    void fetch("/api/page-view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }), keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
