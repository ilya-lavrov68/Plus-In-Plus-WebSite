import { Navbar10 } from "@/components/blocks/navbar10";
import { getFeaturedPost } from "@/lib/data";

/**
 * Шапка сайта.
 *
 * Раздел SHOP временно скрыт из навигации до появления мерча, поэтому услуги
 * из базы сюда больше не подгружаются. Страницы услуг (/shop/[slug]) остаются
 * доступны по прямым ссылкам — через них создаётся заявка на расчёт.
 */
export async function Navbar() {
  const post = await getFeaturedPost();

  return (
    <Navbar10
      featuredPost={post ? { title: post.title, slug: post.slug, coverImage: post.coverImage } : null}
    />
  );
}
