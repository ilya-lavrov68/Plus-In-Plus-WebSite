"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * Навигация админки. Активный раздел помечен `aria-current="page"`, поэтому
 * состояние читается и без цвета. На узких экранах список прокручивается
 * горизонтально, на широких — колонка.
 */
export function AdminNav({ items, label }: { items: AdminNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-2 lg:pb-0">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="min-w-0 shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-2 whitespace-nowrap border border-transparent px-3 py-2 text-sm transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal",
                  active
                    ? "border-border bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
