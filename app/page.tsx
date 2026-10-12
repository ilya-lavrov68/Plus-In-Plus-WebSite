import type { Metadata } from "next";

import { CategoriesSection } from "@/components/site/categories-section";
import { FeaturesSection } from "@/components/site/features-section";
import { HeroSection } from "@/components/site/hero-section";
import { NewsSection } from "@/components/site/news-section";
import { PartnersSection } from "@/components/site/partners-section";
import { getPublishedPosts, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Plus In Plus — design studio",
  description:
    "A next-generation design studio for digital, event, and brand design—from website mockups to posters and event collateral.",
  path: "/",
});

export default async function HomePage() {
  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);
  const locale = await getRequestLocale();

  return (
    <>
      <HeroSection locale={locale} />
      <CategoriesSection />
      <FeaturesSection />
      <PartnersSection />
      <NewsSection items={newsItems} locale={locale} />
    </>
  );
}
