import { randomUUID } from "node:crypto";

import { rows, run, withTransaction } from "@/lib/db";

/**
 * Правила публикаций: те же, что раньше держали хуки CMS.
 *
 * - в избранном может быть только один материал;
 * - в избранное нельзя добавить неопубликованный или запланированный пост;
 * - при первой публикации проставляется дата публикации.
 */

export class PostRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PostRuleError";
  }
}

export interface PostUpdate {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  readTime: number;
  sourceUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function updatePost(input: PostUpdate): Promise<void> {
  return withTransaction(async (tx) => {
    const [current] = await tx.rows<{ is_published: number; published_at: string | null }>(
      `select is_published, published_at from posts where id = ?`,
      [input.id],
    );
    if (!current) throw new PostRuleError("Материал не найден.", "not_found");

    const publishedAt = current.published_at ?? (input.isPublished ? new Date().toISOString() : null);

    if (input.isFeatured) {
      if (!input.isPublished) {
        throw new PostRuleError("В избранное можно добавить только опубликованный материал.", "featured_needs_publish");
      }
      if (publishedAt && new Date(publishedAt).getTime() > Date.now()) {
        throw new PostRuleError("Запланированный материал нельзя добавить в избранное.", "featured_scheduled");
      }
      await tx.run(`update posts set is_featured = 0, updated_at = ? where id <> ? and is_featured = 1`, [
        new Date().toISOString(),
        input.id,
      ]);
    }

    const slug = slugify(input.slug || input.title) || `post-${randomUUID().slice(0, 8)}`;
    const changed = await tx.run(
      `update posts set title = ?, slug = ?, excerpt = ?, content = ?, read_time = ?, source_url = ?,
         is_published = ?, is_featured = ?, published_at = ?, updated_at = ?
       where id = ?`,
      [
        input.title,
        slug,
        input.excerpt,
        input.content,
        Math.min(Math.max(Math.trunc(input.readTime) || 5, 1), 60),
        input.sourceUrl,
        input.isPublished ? 1 : 0,
        input.isFeatured ? 1 : 0,
        publishedAt,
        new Date().toISOString(),
        input.id,
      ],
    );
    if (changed !== 1) throw new PostRuleError("Материал не найден.", "not_found");
  });
}

export async function deletePost(postId: string): Promise<void> {
  if (!(await rows<{ id: string }>(`select id from posts where id = ?`, [postId])).length) {
    throw new PostRuleError("Материал не найден.", "not_found");
  }
  // Галерея удаляется каскадом по posts_rels.
  await run(`delete from posts where id = ?`, [postId]);
}
