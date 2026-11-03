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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={getClientMessages(locale)}>
          <Providers>
            <a
              href="#admin-main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-border focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
            >
              {t.shell.skip}
            </a>
            <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
              <aside className="border-b border-border lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
                <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.brand}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {t.shell.title}
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="whitespace-nowrap text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
                  >
                    {t.shell.viewSite}
                  </Link>
                </div>
                <AdminNav items={items} label={t.shell.nav} />
                <div className="hidden px-5 py-5 text-xs text-muted-foreground lg:block">
                  <p className="truncate" title={staff.email}>
                    {staff.email}
                  </p>
                  <p className="mt-1">
                    {t.shell.role}: {t.roles[staff.role]}
                  </p>
                </div>
              </aside>
              <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </main>
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
