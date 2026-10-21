import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Providers } from "@/app/providers";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { messages } from "@/i18n";

import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  const locale = await getRequestLocale();
  const title = t("siteTitle");
  const description = t("siteDescription");

  return {
    metadataBase: SITE_URL,
    title,
    description,
    icons: {
      icon: "/assets/logos/lnpip.svg",
      shortcut: "/assets/logos/lnpip.svg",
      apple: "/assets/logos/lnpip.svg",
    },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: SITE_NAME,
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
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages[locale]}>
          <Providers>
            <Navbar />
            <main className="flex-1 pt-20">{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
