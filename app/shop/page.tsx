import type { Metadata } from "next";

import { Blog11 } from "@/components/blocks/blog11";
import { Hero138 } from "@/components/blocks/hero138";
import { Services11Catalog } from "@/components/blocks/services11";
import { getPublishedPosts, getPublishedServices } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { mergeCatalogPosts, mergeCatalogServices } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Our Services — Plus In Plus",
    description:
      "Small designs, storefront signs, packaging, and city-scale large billboard formats by Plus In Plus.",
    path: "/shop",
    locale,
  });
}

export default async function ShopPage() {
  const [dbServices, dbPosts] = await Promise.all([
    getPublishedServices(),
    getPublishedPosts(),
  ]);

  const allServices = mergeCatalogServices(dbServices);
  const smallServices = allServices.filter((s) => s.category === "small");
  const largeServices = allServices.filter((s) => s.category === "large");
  const posts = mergeCatalogPosts(dbPosts);

  return (
    <>
      <Hero138
        headingMuted=""
        headingPrimary="Our Services"
        descriptionLead="From tactile branded bags and storefront signage to building wraps and highway billboards—"
        descriptionStrong="every project includes a realistic mockup and print-ready files."
        primaryCta={{ label: "Small designs", href: "#small-designs" }}
        secondaryCta={{ label: "Large designs", href: "#large-designs" }}
        footnote=""
        showMediaStage={false}
        className="border-b border-border"
      />

      <Services11Catalog
        id="small-designs"
        heading="Small designs"
        subtitle="Precision layouts, tactile packaging, glass posters, and custom signage built to stand out up close."
        services={smallServices}
      />

      <Services11Catalog
        id="large-designs"
        heading="Large designs"
        subtitle="Above It All. Rough Roads, Louder Message."
        services={largeServices}
        className="bg-muted/30"
      />

      <Blog11
        id="shop-other-news"
        heading="Other News"
        description="Latest announcements, case notes, and studio releases from Plus In Plus."
        posts={posts.slice(0, 3)}
      />
    </>
  );
}
