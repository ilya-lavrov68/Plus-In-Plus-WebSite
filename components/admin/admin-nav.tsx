"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminNavGroup {
  label?: string;
  items: AdminNavItem[];
}

/**
 * Навигация админки в стиле Material 3 navigation rail/drawer: активный раздел
 * получает tonal-подложку `secondary-container`, состояние дублируется через
 * `aria-current`, поэтому читается и без цвета. На узких экранах список
 * прокручивается горизонтально, на широких — колонка.
 */
export function AdminNav({ groups, label }: { groups: AdminNavGroup[]; label: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav aria-label={label} className="min-w-0">
      {/*
        На узких экранах все разделы выстраиваются в один прокручиваемый ряд
        (`display: contents` выравнивает группы), на широких — колонка с
        заголовками групп.
      */}
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-3 lg:pb-0">
        {groups.map((group, index) => {
          const headingId = group.label ? `admin-nav-group-${index}` : undefined;
          return (
            <div
              key={group.label ?? index}
              className={cn("contents lg:flex lg:flex-col lg:gap-0.5", index > 0 && "lg:mt-3")}
            >
              {group.label ? (
                <p
                  id={headingId}
                  className="hidden px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant/80 lg:block"
                >
                  {group.label}
                </p>
              ) : null}
              <ul
                aria-labelledby={headingId}
                className="contents lg:flex lg:flex-col lg:gap-0.5"
              >
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href} className="min-w-0 shrink-0 lg:shrink">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          // Пункт меню — кнопка: рамка, подложка и явные состояния.
                          "flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border px-4 text-sm transition-colors duration-200 lg:min-h-10 lg:w-full lg:justify-start lg:px-3",
                          "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          active
                            ? "border-signal/45 bg-surface-container-high font-medium text-signal"
                            : "border-outline-variant/70 bg-surface-container/50 text-on-surface-variant hover:border-outline hover:bg-hover-surface hover:text-signal",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
