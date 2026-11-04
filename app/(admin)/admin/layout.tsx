import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { AdminNav, type AdminNavGroup } from "@/components/admin/admin-nav";
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
  // Вкладка админки узнаётся по знаку, а не по тексту.
  icons: {
    icon: "/assets/logos/lnpip.svg",
    shortcut: "/assets/logos/lnpip.svg",
    apple: "/assets/logos/lnpip.svg",
  },
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

  // Разделы сгруппированы: десять ссылок подряд читаются как список, а не как панель.
  const groups: AdminNavGroup[] = [
    {
      label: t.shell.groups.main,
      items: [
        { href: "/admin", label: t.nav.overview },
        { href: "/admin/orders", label: t.nav.orders },
      ],
    },
    {
      label: t.shell.groups.catalog,
      items: [
        { href: "/admin/services", label: t.nav.services },
        { href: "/admin/products", label: t.nav.products },
      ],
    },
    {
      label: t.shell.groups.content,
      items: [
        { href: "/admin/posts", label: t.nav.posts },
        ...(staff.isAdmin ? [{ href: "/admin/story", label: t.nav.story }] : []),
        ...(staff.isAdmin ? [{ href: "/admin/media", label: t.nav.media }] : []),
      ],
    },
    {
      label: t.shell.groups.system,
      items: [
        ...(staff.isAdmin ? [{ href: "/admin/accounts", label: t.nav.accounts }] : []),
        ...(staff.isAdmin ? [{ href: "/admin/activity", label: t.nav.activity }] : []),
        ...(staff.isFounder ? [{ href: "/admin/settings", label: t.nav.settings }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);

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
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-on-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-surface"
            >
              {t.shell.skip}
            </a>
            <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
              <aside className="border-b border-outline-variant/60 bg-surface/60 backdrop-blur-2xl lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-4">
                <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-5 lg:pt-3">
                  <Link
                    href="/admin"
                    className="flex min-w-0 items-center gap-3 rounded-2xl py-1 pl-1 pr-2 transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-outline-variant/70 bg-surface-container-high">
                      <img
                        src="/assets/logos/lnpip.svg"
                        alt=""
                        aria-hidden="true"
                        width={54}
                        height={42}
                        className="h-5 w-auto select-none"
                      />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-on-surface">{t.shell.title}</span>
                  </Link>
                  <Link
                    href="/"
                    className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs text-on-surface-variant transition-colors duration-200 hover:bg-hover-surface hover:text-signal focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {t.shell.viewSite}
                  </Link>
                </div>
                <AdminNav groups={groups} label={t.shell.nav} />
                <div className="mt-auto hidden gap-1 px-5 pb-2 pt-6 text-xs text-on-surface-variant lg:flex lg:flex-col">
                  <span className="truncate font-medium text-on-surface" title={staff.email}>
                    {staff.email}
                  </span>
                  <span className="rounded-full border border-outline-variant/60 px-2.5 py-1 text-[11px] text-on-surface-variant">
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
