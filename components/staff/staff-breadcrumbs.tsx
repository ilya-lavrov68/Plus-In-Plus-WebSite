"use client";

import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Сегмент служебного URL → ключ в пространстве `admin`.
 * Одна реализация на обе части сайта: /admin и /manager.
 */
const segmentKeys: Record<string, string> = {
  admin: "breadcrumbAdmin",
  manager: "breadcrumbManager",
  orders: "orders",
  dashboard: "dashboard",
  services: "services",
  blog: "blog",
  users: "users",
  settings: "settings",
  new: "breadcrumbNew",
};

export function StaffBreadcrumbs() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const pathname = usePathname() || "/admin/dashboard";
  const router = useRouter();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((part, index) => ({
    label: segmentKeys[part] ? t(segmentKeys[part]) : part.length > 18 ? tc("edit") : part,
    href: `/${parts.slice(0, index + 1).join("/")}`,
  }));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <button type="button" onClick={() => router.back()} className="font-medium inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-200 ease-out hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <nav aria-label={tc("breadcrumb")} className="flex items-center gap-1">
        {crumbs.map((crumb, index) => <span key={crumb.href} className="inline-flex items-center gap-1"><Link href={crumb.href} className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{crumb.label}</Link>{index < crumbs.length - 1 ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /> : null}</span>)}
      </nav>
    </div>
  );
}
