import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { addToCart } from "@/app/actions/cart";
import { requestQuote } from "@/app/actions/orders";
import { Blog11 } from "@/components/blocks/blog11";
import { ProductDetail1 } from "@/components/blocks/product-detail1";
import { ServiceConfigurator } from "@/components/site/service-configurator";
import {
  getPublishedPosts,
  getPublishedService,
  getServicePricing,
} from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import {
  mergeCatalogPosts,
  resolveServiceBySlug,
} from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [dbService, locale] = await Promise.all([
    getPublishedService(slug),
    getRequestLocale(),
  ]);
  const service = resolveServiceBySlug(slug, dbService);

  return createPageMetadata({
    title: service
      ? `${service.title} — Plus In Plus`
      : "Our Services — Plus In Plus",
    description:
      service?.shortDesc ||
      "Custom design services with 3D mockups and print-ready production files.",
    path: `/shop/${encodeURIComponent(slug)}`,
    image: service?.coverImage,
    locale,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const [dbService, pricing, dbPosts] = await Promise.all([
    getPublishedService(slug),
    getServicePricing(slug),
    getPublishedPosts(),
  ]);

  const service = resolveServiceBySlug(slug, dbService);
  if (!service) {
    redirect("/shop");
  }

  const posts = mergeCatalogPosts(dbPosts);

  const configuratorNode = pricing ? (
    <ServiceConfigurator
      pricing={pricing}
      onSubmit={async (optionIds) => {
        "use server";
        return requestQuote({ serviceId: pricing.serviceId, optionIds });
      }}
      onAddToCart={async (optionIds) => {
        "use server";
        return addToCart({ serviceId: pricing.serviceId, optionIds });
      }}
    />
  ) : null;

  return (
    <>
      <ProductDetail1
        service={service}
        configuratorSlot={configuratorNode}
      />
      <Blog11
        id="service-other-news"
        heading="Other News"
        description="Latest announcements, case notes, and studio releases from Plus In Plus."
        posts={posts.slice(0, 3)}
      />
    </>
  );
}
