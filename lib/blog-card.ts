import type { CatalogBlogPost } from "@/lib/studio-catalog";

/**
 * Сколько символов анонса уезжает в браузер вместе с карточкой. В списке
 * анонс обрезан двумя строками, поэтому полный текст в payload не нужен.
 */
const EXCERPT_LIMIT = 220;

function cardExcerpt(excerpt: string): string {
  const text = excerpt.trim();
  if (text.length <= EXCERPT_LIMIT) return text;
  return `${text.slice(0, EXCERPT_LIMIT - 1).trimEnd()}…`;
}

/**
 * Только данные, которые Blog11 передаёт в браузер для карточки. Тело статьи,
 * секции и служебные поля остаются на сервере: списку нужны заголовок,
 * обложка, короткий анонс и время чтения.
 */
export type BlogCardData = Pick<
  CatalogBlogPost,
  "id" | "slug" | "title" | "dateLabel" | "category" | "image" | "excerpt" | "readTime"
>;

export function toBlogCardData(post: CatalogBlogPost): BlogCardData {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    dateLabel: post.dateLabel,
    category: post.category,
    image: post.image,
    excerpt: cardExcerpt(post.excerpt ?? ""),
    readTime: post.readTime,
  };
}
