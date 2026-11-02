import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { CookieBanner } from "@/components/site/cookie-banner";
import { Providers } from "@/app/providers";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";
import { getPublicSiteSettings } from "@/lib/public-site-settings";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getClientMessages } from "@/i18n-catalog";

import "@/styles/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, settings] = await Promise.all([
    getRequestTranslations("metadata"),
    getRequestLocale(),
    getPublicSiteSettings(),
  ]);
  const title = settings.metaTitle ?? t("siteTitle");
  const description = settings.metaDescription ?? t("siteDescription");
  const siteName = settings.studioName ?? SITE_NAME;

  return {
    metadataBase: SITE_URL,
    title,
    description,
    keywords: settings.metaKeywords,
    icons: {
      icon: "/assets/logos/lnpip.svg",
      shortcut: "/assets/logos/lnpip.svg",
      apple: "/assets/logos/lnpip.svg",
    },
    openGraph: {
      type: "website",
      title,
      description,
      siteName,
      locale: locale === "ru" ? "ru_RU" : "en_US",
      url: absoluteUrl("/"),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} data-locale={locale} className="dark">
      <head>
        <link
          rel="preload"
          href="/assets/fonts/geist-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/google-sans-flex-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {locale === "ru" ? (
          <link
            rel="preload"
            href="/assets/fonts/inter-cyrillic-wght-normal.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className="flex min-h-screen flex-col bg-background pb-[var(--mobile-bottom-nav-clearance)] text-foreground antialiased lg:pb-0">
        <NextIntlClientProvider locale={locale} messages={getClientMessages(locale)}>
          <Providers>
            <Navbar />
            <main className="flex-1 pt-24 sm:pt-28">{children}</main>
            <Footer />
            {/* Уведомление о cookie: один раз, пока посетитель не сделает выбор. */}
            <CookieBanner />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
