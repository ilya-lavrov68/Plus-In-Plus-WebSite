import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { adminLabels } from "@/components/admin/labels";
import { Providers } from "@/app/providers";
import { requireStaff } from "@/lib/admin-session";
import { getClientMessages } from "@/i18n-catalog";
import { getRequestLocale } from "@/lib/request-locale";

import "@/styles/globals.css";

// Панель читает cookies сессии на каждом запросе: статический рендер ей не подходит.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plus In Plus — Админ",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // proxy.ts уже закрывает /admin, здесь — вторая проверка на уровне страницы.
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");

  const locale = await getRequestLocale();
  const t = adminLabels(locale);

  const items: AdminNavItem[] = [
    { href: "/admin", label: t.nav.overview },
    { href: "/admin/orders", label: t.nav.orders },
    { href: "/admin/services", label: t.nav.services },
    { href: "/admin/products", label: t.nav.products },
    { href: "/admin/posts", label: t.nav.posts },
    ...(staff.isAdmin ? [{ href: "/admin/story", label: t.nav.story }] : []),
    ...(staff.isAdmin ? [{ href: "/admin/media", label: t.nav.media }] : []),
    ...(staff.isAdmin ? [{ href: "/admin/accounts", label: t.nav.accounts }] : []),
    ...(staff.isAdmin ? [{ href: "/admin/activity", label: t.nav.activity }] : []),
    ...(staff.isFounder ? [{ href: "/admin/settings", label: t.nav.settings }] : []),
  ];

  return (
    <html lang={locale} data-locale={locale} className="dark">
      <head>
        <link rel="preload" href="/assets/fonts/geist-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/assets/fonts/google-sans-flex-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="admin-md min-h-screen bg-surface text-on-surface antialiased">
        <NextIntlClientProvider locale={locale} messages={getClientMessages(locale)}>
          <Providers>
            <a
              href="#admin-main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary"
            >
              {t.shell.skip}
            </a>
            <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
              <aside className="bg-surface-container-low lg:w-72 lg:shrink-0 lg:py-4">
                <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 lg:pt-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">{t.brand}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                      {t.shell.title}
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {t.shell.viewSite}
                  </Link>
                </div>
                <AdminNav items={items} label={t.shell.nav} />
                <div className="mt-auto hidden gap-1 px-5 pb-2 pt-6 text-xs text-on-surface-variant lg:flex lg:flex-col">
                  <span className="truncate font-medium text-on-surface" title={staff.email}>
                    {staff.email}
                  </span>
                  <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] text-on-surface-variant">
                    {t.shell.role}: {t.roles[staff.role]}
                  </span>
                </div>
              </aside>
              <main
                id="admin-main"
                className="min-w-0 flex-1 bg-surface px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
              >
                <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">{children}</div>
              </main>
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
