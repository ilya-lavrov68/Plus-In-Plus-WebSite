"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";

export interface AdminHeaderSection {
  href: string;
  label: string;
}

/**
 * Шапка рабочей области: триггер панели, название текущего раздела и переход на
 * сайт. Фон — плотное стекло: контент под шапкой не должен «просвечивать» до
 * нечитаемости, но блюр остаётся заметным.
 */
export function AdminHeader({
  sections,
  viewSite,
  toggleLabel,
}: {
  sections: AdminHeaderSection[];
  viewSite: string;
  toggleLabel: string;
}) {
  const pathname = usePathname();
  const current =
    sections
      .filter((section) => (section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href)))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? sections[0];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-surface/85 px-4 backdrop-blur-2xl sm:px-6">
      <SidebarTrigger className="-ml-1" label={toggleLabel} />
      <span className="h-4 w-px shrink-0 bg-outline-variant/70" aria-hidden="true" />
      <span className="min-w-0 truncate text-sm font-medium text-on-surface" aria-current="page">
        {current?.label}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/"
          className="rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {viewSite}
        </Link>
      </div>
    </header>
  );
}
