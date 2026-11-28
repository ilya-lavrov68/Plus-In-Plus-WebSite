import { BlogSection } from "@/components/site/blog-section";
import { CtaSection } from "@/components/site/cta-section";
import { Hero } from "@/components/site/hero";
import { HomeProduct } from "@/components/site/home-product";
import { ProcessSection } from "@/components/site/process-section";
import { WorkIndex } from "@/components/site/work-index";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Словари берутся отдельными константами: tests/i18n.test.cjs сверяет
  // `t("ключ")` с каталогом по паре «переменная → namespace», поэтому
  // деструктуризация из Promise.all спрятала бы от проверки missing message.
  const t = await getRequestTranslations("news");
  const tHome = await getRequestTranslations("home");
  const tBlog = await getRequestTranslations("blog");
  const [dbPosts, locale] = await Promise.all([getPublishedPosts(3), getRequestLocale()]);
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), tBlog, locale).slice(0, 3);

  return (
    <>
      <Hero />
      {/* После первого экрана — продукт, как на продуктовой странице: имя,
          одна строка, действия. Дальше доказательства и процесс. */}
      <HomeProduct />
      <WorkIndex
        compact
        limit={3}
        allHref="/work"
        heading={tHome("workTitle")}
        lead={tHome("workLead")}
        className="section-y-tight"
      />
      <ProcessSection />
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
