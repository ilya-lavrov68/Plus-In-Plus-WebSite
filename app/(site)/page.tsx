import { BlogSection } from "@/components/site/blog-section";
import { BrandDirections } from "@/components/site/brand-directions";
import { Community } from "@/components/site/community";
import { CtaSection } from "@/components/site/cta-section";
import { Features } from "@/components/site/features";
import { Hero } from "@/components/site/hero";
import { Story } from "@/components/site/story";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [dbPosts, locale, t, tBlog] = await Promise.all([
    getPublishedPosts(3),
    getRequestLocale(),
    getRequestTranslations("news"),
    getRequestTranslations("blog"),
  ]);
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), tBlog, locale).slice(0, 3);

  return (
    <>
      <Hero />
      <BrandDirections />
      <Story />
      <Features />
      <Community />
      <BlogSection
        id="news"
        heading={t("title")}
        description={t("description")}
        posts={posts}
        allCategoryLabel={tBlog("allCategory")}
        categoryLabels={{
          Design: tBlog("categoryDesign"),
          Studio: tBlog("categoryStudio"),
          Outdoor: tBlog("categoryOutdoor"),
        }}
        emptyTitle={tBlog("empty.title")}
        emptyDescription={tBlog("empty.description")}
        labels={{
          eyebrow: tBlog("eyebrow"),
          emptyEyebrow: tBlog("empty.eyebrow"),
          featuredLabel: tBlog("featured"),
          readTimeTemplate: String(tBlog.raw("readTime")),
          readLabel: tBlog("read"),
          ctaTitle: tBlog("cta.title"),
          ctaDescription: tBlog("cta.description"),
          ctaAction: tBlog("cta.action"),
        }}
      />
      <CtaSection />
    </>
  );
}
