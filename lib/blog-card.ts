import type { CatalogBlogPost } from "@/lib/studio-catalog";

/** Только данные, которые Blog11 действительно передаёт в браузер для карточки. */
export type BlogCardData = Pick<
  CatalogBlogPost,
  "id" | "slug" | "title" | "dateLabel" | "category" | "image"
>;

export function toBlogCardData(post: CatalogBlogPost): BlogCardData {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    dateLabel: post.dateLabel,
    category: post.category,
    image: post.image,
  };
}
