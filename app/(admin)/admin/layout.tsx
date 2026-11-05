import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { AdminHeader, type AdminHeaderSection } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { AdminNavGroup } from "@/components/admin/admin-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { adminLabels } from "@/components/admin/labels";
import { ChunkRecovery } from "@/components/site/chunk-recovery";
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

  // Состояние панели приходит из cookie: серверный рендер не «прыгает» при гидрации.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Заголовок шапки берётся из того же списка разделов, что и навигация.
  const sections: AdminHeaderSection[] = groups.flatMap((group) => group.items);

  return (
    <html lang={locale} data-locale={locale} className="dark" data-scroll-behavior="smooth">
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
        <NextIntlClientProvider locale={locale} messages={getClientMessages(locale, "admin")}>
          <Providers>
            <ChunkRecovery />
            <a
              href="#admin-main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-on-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-surface"
            >
              {t.shell.skip}
            </a>
            <SidebarProvider defaultOpen={sidebarOpen}>
              <AdminSidebar
                groups={groups}
                quickCreateItems={[
                  { href: "/admin/services/new", label: t.shell.newService },
                  { href: "/admin/products/new", label: t.shell.newProduct },
                  { href: "/admin/posts/new", label: t.shell.newPost },
                ]}
                labels={{
                  title: t.shell.title,
                  navLabel: t.shell.nav,
                  quickCreate: t.shell.quickCreate,
                  quickCreateHint: t.shell.quickCreateHint,
                  account: t.shell.account,
                  viewSite: t.shell.viewSite,
                  settings: t.nav.settings,
                  toggle: t.shell.toggle,
                }}
                user={{ email: staff.email, roleLabel: t.roles[staff.role] ?? staff.role }}
                settingsHref={staff.isFounder ? "/admin/settings" : undefined}
              />
              <SidebarInset id="admin-main">
                <AdminHeader sections={sections} viewSite={t.shell.viewSite} toggleLabel={t.shell.toggle} />
                <div className="@container/main flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
