import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductTemplateView } from "@/components/site/product-template-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getStudioProductBySlug } from "@/lib/studio-products";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Шаблон страницы продукта.
 *
 * Любой продукт, опубликованный в админке, открывается здесь по slug. Страницы,
 * у которых уже есть свой адрес (Line Launcher), живут по нему, а эта служит
 * витриной для новых.
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const product = await getStudioProductBySlug(slug).catch(() => null);

  if (!product || !product.published) {
    // Продукт снят с публикации или не создан — поисковику здесь делать нечего.
    return { title: "404 — Plus In Plus", robots: { index: false, follow: false } };
  }

  const description = locale === "en" ? product.taglineEn : product.taglineRu;

  return createPageMetadata({
    title: `${product.name} — Plus In Plus`,
    description: description || product.name,
    path: `/products/${product.slug}`,
    locale,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  // Витрина не должна ронять сайт: нет таблицы, база только на чтение или
  // продукт снят с публикации — для посетителя это одинаковый 404.
  const product = await getStudioProductBySlug(slug).catch(() => null);

  if (!product || !product.published) notFound();

  return <ProductTemplateView product={product} />;
}
