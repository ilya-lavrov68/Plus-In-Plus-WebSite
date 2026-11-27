import { Navbar10, type NavbarProduct } from "@/components/blocks/navbar10";
import { getRequestLocale } from "@/lib/request-locale";
import { listPublishedStudioProducts, studioProductPath } from "@/lib/studio-products";

/**
 * Шапка сайта.
 *
 * Список продуктов в меню собирается из админки: опубликованные продукты
 * студии приходят из базы. Пока там пусто, работает статический реестр
 * `lib/products.ts` — шапка не остаётся без продукта на чистой установке.
 *
 * Ошибку чтения базы глушим осознанно: шапка не должна падать из-за витрины.
 */
export async function Navbar() {
  const locale = await getRequestLocale();

  let products: NavbarProduct[] | undefined;
  try {
    const published = await listPublishedStudioProducts();
    if (published.length > 0) {
      products = published.map((product) => ({
        name: product.name,
        badge: product.version || undefined,
        description:
          (locale === "en" ? product.taglineEn || product.taglineRu : product.taglineRu || product.taglineEn) ||
          undefined,
        href: studioProductPath(product),
      }));
    }
  } catch {
    products = undefined;
  }

  return <Navbar10 products={products} />;
}
