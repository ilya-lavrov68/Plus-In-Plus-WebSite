import { BlogSection } from "@/components/site/blog-section";
import { Community } from "@/components/site/community";
import { CtaSection } from "@/components/site/cta-section";
import { Features } from "@/components/site/features";
import { Hero } from "@/components/site/hero";
import { getPublishedPosts } from "@/lib/data";
import { mergeCatalogPosts } from "@/lib/studio-catalog";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [dbPosts, t] = await Promise.all([
    getPublishedPosts(),
    getRequestTranslations("news"),
  ]);
  const posts = mergeCatalogPosts(dbPosts).slice(0, 3);

  return (
    <>
      <Hero />
      <Features />
      <Community />
      <BlogSection id="news" heading={t("title")} description={t("description")} posts={posts} />
      <CtaSection />
    </>
  );
}
