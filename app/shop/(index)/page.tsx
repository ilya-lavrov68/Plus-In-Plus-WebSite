import type { Metadata } from "next";

import {
  ShopCatalogView,
  type ShopProductCardData,
} from "@/components/site/shop-catalog-view";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

async function getActiveShopProducts(): Promise<ShopProductCardData[]> {
  if (!prisma) return [];

  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      price: row.price,
      coverImage: row.coverImage,
      category: row.category,
      stock: row.stock,
    }));
  } catch (error) {
    console.error("Failed to load shop products:", error);
    return [];
  }
}

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
