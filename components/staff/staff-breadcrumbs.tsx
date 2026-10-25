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
  analytics: "analytics",
  services: "services",
  blog: "blog",
  story: "story",
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
    <div className="mb-6 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{tc("back")}</span>
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <nav aria-label={tc("breadcrumb")} className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.href} className="inline-flex items-center gap-1.5">
              <Link
                href={crumb.href}
                aria-current={isLast ? "page" : undefined}
                className={
                  isLast
                    ? "rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "rounded-sm transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                }
              >
                {crumb.label}
              </Link>
              {!isLast ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60" /> : null}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
