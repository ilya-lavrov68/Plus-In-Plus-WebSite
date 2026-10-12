import type { Metadata } from "next";

import { CategoriesSection } from "@/components/site/categories-section";
import { FeaturesSection } from "@/components/site/features-section";
import { HeroSection } from "@/components/site/hero-section";
import { NewsSection } from "@/components/site/news-section";
import { PartnersSection } from "@/components/site/partners-section";
import { getPublishedPosts, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: t("home"),
    description: t("homeDescription"),
    path: "/",
    locale,
  });
}

export default async function HomePage() {
  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <HeroSection />
      <CategoriesSection />
      <FeaturesSection />
      <PartnersSection />
      <NewsSection items={newsItems} />
    </>
  );
}
