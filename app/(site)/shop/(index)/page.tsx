import type { Metadata } from "next";
import { cache } from "react";

import { ShopCatalogView, type ShopProductCardData } from "@/components/site/shop-catalog-view";
import { listActiveProducts } from "@/lib/commerce-data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

/** React cache deduplicates the metadata and page query within one request. */
const getActiveShopProducts = cache(async (): Promise<ShopProductCardData[]> => {
  try {
    const products = await listActiveProducts();
    return products.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      price: row.price,
      coverImage: row.coverImage ?? row.cover.url,
      category: row.category ?? null,
      stock: row.stock,
    }));
  } catch (error) {
    console.error("Failed to load shop products:", error);
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, products] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("shop"),
    getActiveShopProducts(),
  ]);
  const hasProducts = products.length > 0;
  return {
    ...createPageMetadata({
      title: hasProducts ? t("catalogTitle") : t("comingSoonTitle"),
      description: hasProducts ? t("catalogDescription") : t("comingSoonBody"),
      path: "/shop",
      locale,
    }),
    robots: { index: hasProducts, follow: true },
  };
}

export default async function ShopPage() {
  const products = await getActiveShopProducts();
  return <ShopCatalogView products={products} />;
}
