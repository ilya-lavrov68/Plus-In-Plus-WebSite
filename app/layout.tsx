import type { Metadata } from "next";

import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DEFAULT_SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
