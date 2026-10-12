import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Providers } from "@/app/providers";
import { DEFAULT_SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { messages } from "@/i18n";

import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE_NAME,
  description: DEFAULT_SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    title: SITE_NAME,
    description: DEFAULT_SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "ru_RU",
    url: absoluteUrl("/"),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages[locale]}>
          <Providers>
            <AnnouncementBar />
            <Header />
            <main className="flex-1 pt-16">{children}</main>
            <Footer locale={locale} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
