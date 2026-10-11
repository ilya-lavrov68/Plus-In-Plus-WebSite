import { ArrowRight, Building2, PenTool } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { ShopServiceCard } from "@/components/site/shop-service-card";
import { getPublishedPosts, getPublishedServices, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Shop — Plus In Plus",
  description: "Plus In Plus service catalog: small and large design projects with details and examples.",
  path: "/shop",
});

export default async function ShopPage() {
  const [services, posts] = await Promise.all([getPublishedServices(), getPublishedPosts()]);
  const smallServices = services.filter((service) => service.category === "small");
  const largeServices = services.filter((service) => service.category === "large");
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <InternalPageHeader title="SHOP" />

      <InternalPageContent labelledBy="shop-our-services">
        <h2 id="shop-our-services" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Our Services
        </h2>

        <section aria-labelledby="small-designs" className="mt-12">
          <h3
            id="small-designs"
            className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Small designs
            <ArrowRight aria-hidden="true" className="h-6 w-6" />
          </h3>
          {smallServices.length ? (
            <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {smallServices.map((service) => (
                <li key={service.id}>
                  <ShopServiceCard
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
          <h3
            id="large-designs"
            className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Large designs
            <ArrowRight aria-hidden="true" className="h-6 w-6" />
          </h3>
          <p className="mt-3 text-lg">Above It All. Rough Roads, Louder Message.</p>
          {largeServices.length ? (
            <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {largeServices.map((service) => (
                <li key={service.id}>
                  <ShopServiceCard
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
      </InternalPageContent>

      <OtherNewsSection items={newsItems} id="shop-other-news" />
    </>
  );
}
