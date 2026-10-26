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

async function hasActiveShopProducts(): Promise<boolean> {
  if (!prisma) return false;

  try {
    return (await prisma.product.count({ where: { isActive: true } })) > 0;
  } catch (error) {
    console.error("Failed to count shop products for metadata:", error);
    return false;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, hasProducts] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("shop"),
    hasActiveShopProducts(),
  ]);

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
