import { redirect } from "next/navigation";

import { addToCart } from "@/app/actions/cart";
import { requestQuote } from "@/app/actions/orders";
import { Blog11 } from "@/components/blocks/blog11";
import { ProductDetail1 } from "@/components/blocks/product-detail1";
import { ServiceConfigurator } from "@/components/site/service-configurator";
import { localizeBlogPosts } from "@/lib/blog-localization";
import {
  getPublishedPosts,
  getPublishedService,
  getServicePricing,
} from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeCatalogService } from "@/lib/service-localization";
import {
  mergeCatalogPosts,
  resolveServiceBySlug,
} from "@/lib/studio-catalog";

export default async function ServiceContent({ slug }: { slug: string }) {
  const [dbService, pricing, dbPosts, locale, tBlog, tServices, tHero] =
    await Promise.all([
      getPublishedService(slug),
      getServicePricing(slug),
      getPublishedPosts(),
      getRequestLocale(),
      getRequestTranslations("blog"),
      getRequestTranslations("services"),
      getRequestTranslations("hero"),
    ]);

  const rawService = resolveServiceBySlug(slug, dbService);
  if (!rawService) {
    redirect("/services");
  }

  const service = localizeCatalogService(rawService, locale);
  const localizedPricing = pricing
    ? { ...pricing, title: service.title }
    : null;
  const posts = localizeBlogPosts(mergeCatalogPosts(dbPosts), tBlog, locale);

  const configuratorNode = localizedPricing ? (
    <ServiceConfigurator
      pricing={localizedPricing}
      onSubmit={async (optionIds) => {
        "use server";
        return requestQuote({ serviceId: localizedPricing.serviceId, optionIds });
      }}
      onAddToCart={
        localizedPricing.isOrderable && localizedPricing.priceType !== "quote"
          ? async (optionIds) => {
              "use server";
              return addToCart({ serviceId: localizedPricing.serviceId, optionIds });
            }
          : undefined
      }
    />
  ) : null;

  const detailLabels =
    locale === "ru"
      ? {
          smallDesigns: tServices("smallDesigns"),
          largeDesigns: tServices("largeDesigns"),
          order: tHero("order"),
          includesTitle: "В услугу входит",
          shapesTitle: "Любая форма, любая идея",
          resultTitle: "Результат",
        }
      : {
          smallDesigns: tServices("smallDesigns"),
          largeDesigns: tServices("largeDesigns"),
          order: tHero("order"),
          includesTitle: "Our service includes",
          shapesTitle: "Any shape, any idea",
          resultTitle: "The result",
        };

  return (
    <>
      <ProductDetail1
        service={service}
        serviceId={dbService?.id}
        canAddToCart={Boolean(
          localizedPricing?.isOrderable && localizedPricing.priceType !== "quote"
        )}
        configuratorSlot={configuratorNode}
        labels={detailLabels}
      />
      <Blog11
        id="service-other-news"
        heading={tBlog("otherNews")}
        description={tBlog("otherNewsDescription")}
        posts={posts.slice(0, 3)}
        allCategoryLabel={tBlog("allCategory")}
        categoryLabels={{
          Design: tBlog("categoryDesign"),
          Studio: tBlog("categoryStudio"),
          Outdoor: tBlog("categoryOutdoor"),
        }}
        emptyTitle={tBlog("empty.title")}
        emptyDescription={tBlog("empty.description")}
      />
    </>
  );
}
