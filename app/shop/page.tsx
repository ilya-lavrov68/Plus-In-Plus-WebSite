import { ArrowRight, Building2, PenTool } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { ShopServiceCard } from "@/components/site/shop-service-card";
import { getPublishedPosts, getPublishedServices, serviceHref, toNewsItem } from "@/lib/data";
import { getServiceArtwork } from "@/lib/shop-assets";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Shop — Plus In Plus",
  description: "Plus In Plus service catalog: small and large design projects with details and examples.",
  path: "/shop",
});

const serviceRailClass =
  "mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-8 sm:gap-5 xl:mt-16 xl:gap-11";
const serviceCardItemClass =
  "h-[clamp(360px,31.25vw,600px)] w-[clamp(260px,23.4375vw,450px)] shrink-0 snap-start";

export default async function ShopPage() {
  const [services, posts] = await Promise.all([getPublishedServices(), getPublishedPosts()]);
  const smallServices = services.filter((service) => service.category === "small");
  const largeServices = services.filter((service) => service.category === "large");
  const newsItems = posts.map(toNewsItem);
  const locale = await getRequestLocale();

  return (
    <>
      <InternalPageHeader title="SHOP" />

      <section
        aria-labelledby="shop-our-services"
        className="rounded-t-[3rem] bg-[#CFE0FF] pt-[clamp(4.5rem,9.65vw,11.55rem)] text-[#052B42] sm:rounded-t-[4rem] lg:rounded-t-[100px]"
      >
        <div className="mx-auto max-w-[1550px] px-5 sm:px-8 lg:px-10">
          <h2 id="shop-our-services" className="font-geist text-3xl font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl">
            Our Services
          </h2>
        </div>

        <div className="mt-10 rounded-[2.5rem] bg-white px-5 pb-14 pt-10 sm:mt-12 sm:rounded-[4rem] sm:px-8 sm:py-12 lg:mt-14 lg:rounded-[100px] lg:px-[42px] lg:pb-[226px] lg:pt-[66px]">
          <section aria-labelledby="small-designs">
            <h3
              id="small-designs"
              className="flex items-center gap-3 font-geist text-2xl font-semibold tracking-[-0.035em] sm:text-3xl lg:text-4xl"
            >
              Small designs
              <ArrowRight aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7" />
            </h3>

            {smallServices.length ? (
              <ul className={serviceRailClass}>
                {smallServices.map((service) => (
                  <li key={service.id} className={serviceCardItemClass}>
                    <ShopServiceCard
                      title={service.title}
                      href={serviceHref(service)}
                      imageSrc={getServiceArtwork(service)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 rounded-[1.75rem] bg-[#CFE0FF]/45">
                <EmptyState
                  icon={PenTool}
                  title="No small designs yet"
                  description="New small designs will appear here soon."
                />
              </div>
            )}
          </section>

          <section aria-labelledby="large-designs" className="mt-12 sm:mt-16 lg:mt-16">
            <h3
              id="large-designs"
              className="flex items-center gap-3 font-geist text-2xl font-semibold tracking-[-0.035em] sm:text-3xl lg:text-4xl"
            >
              Large designs
              <ArrowRight aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7" />
            </h3>
            <p className="mt-3 font-body text-base leading-relaxed sm:text-lg">
              Above It All. Rough Roads, Louder Message.
            </p>

            {largeServices.length ? (
              <ul className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-8 sm:gap-5 xl:mt-8 xl:gap-11">
                {largeServices.map((service) => (
                  <li key={service.id} className={serviceCardItemClass}>
                    <ShopServiceCard
                      title={service.title}
                      href={serviceHref(service)}
                      imageSrc={getServiceArtwork(service)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 rounded-[1.75rem] bg-[#CFE0FF]/45">
                <EmptyState
                  icon={Building2}
                  title="No large designs yet"
                  description="New large designs will appear here soon."
                />
              </div>
            )}
          </section>
        </div>
      </section>

      <OtherNewsSection items={newsItems} id="shop-other-news" locale={locale} />
    </>
  );
}
