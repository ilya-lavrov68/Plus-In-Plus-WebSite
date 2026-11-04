"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * Навигация админки в стиле Material 3 navigation rail/drawer: активный раздел
 * получает tonal-подложку `secondary-container`, состояние дублируется через
 * `aria-current`, поэтому читается и без цвета. На узких экранах список
 * прокручивается горизонтально, на широких — колонка.
 */
export function AdminNav({ items, label }: { items: AdminNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-3 lg:pb-0">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="min-w-0 shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition-colors duration-200 lg:min-h-10 lg:py-2",
                  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active
                    ? "bg-secondary-container font-medium text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
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
