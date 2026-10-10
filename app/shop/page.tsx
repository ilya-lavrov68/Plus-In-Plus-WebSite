import { ArrowRight, Building2, Newspaper, PenTool } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import { ServiceCard } from "@/components/site/service-card";
import { getPublishedPosts, getPublishedServices, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Услуги дизайна — Plus In Plus",
  description:
    "Каталог услуг Plus In Plus: малые и крупные дизайн-проекты с подробным описанием и примерами.",
  path: "/shop",
});

export default async function ShopPage() {
  const [services, posts] = await Promise.all([getPublishedServices(), getPublishedPosts()]);
  const smallServices = services.filter((service) => service.category === "small");
  const largeServices = services.filter((service) => service.category === "large");
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <div className="text-[#052B42] mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Our Services</h1>

        <section aria-labelledby="small-designs" className="mt-12">
          <h2
            id="small-designs"
            className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Small designs
            <ArrowRight aria-hidden="true" className="h-6 w-6" />
          </h2>
          {smallServices.length ? (
            <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {smallServices.map((service) => (
                <li key={service.id}>
                  <ServiceCard
                    title={service.title}
                    href={`/shop/${service.id}`}
                    imageSrc={service.coverImage}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PenTool}
              title="No small designs yet"
              description="New small designs will appear here soon."
            />
          )}
        </section>

        <section aria-labelledby="large-designs" className="mt-16">
          <h2
            id="large-designs"
            className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Large designs
            <ArrowRight aria-hidden="true" className="h-6 w-6" />
          </h2>
          <p className="mt-3 text-[#052B42]">Above It All. Rough Roads, Louder Message.</p>
          {largeServices.length ? (
            <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {largeServices.map((service) => (
                <li key={service.id}>
                  <ServiceCard
                    title={service.title}
                    href={`/shop/${service.id}`}
                    imageSrc={service.coverImage}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Building2}
              title="No large designs yet"
              description="New large designs will appear here soon."
            />
          )}
        </section>
      </div>

      <section aria-labelledby="shop-other-news" className="bg-[#D6E4FF] text-[#052B42]">
        <div className="text-[#052B42] mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <h2
            id="shop-other-news"
            className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Other News
          </h2>
          <div className="mt-10 sm:mt-12">
            {newsItems.length ? (
              <NewsCarousel items={newsItems} label="Other news" />
            ) : (
              <EmptyState
                icon={Newspaper}
                title="No news yet"
                description="Check back later for updates."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
