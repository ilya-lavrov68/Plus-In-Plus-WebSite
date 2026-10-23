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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getRequestTranslations("shop");
  return {
    ...createPageMetadata({
      title: t("comingSoonTitle"),
      description: t("comingSoonBody"),
      path: "/shop",
      locale,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function ShopPage() {
  let products: ShopProductCardData[] = [];
  if (prisma) {
    try {
      const rows = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      products = rows.map((row) => ({
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
    }
  }

  return <ShopCatalogView products={products} />;
}
