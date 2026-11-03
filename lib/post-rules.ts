import { randomUUID } from "node:crypto";

import { rows, run, withTransaction } from "@/lib/db";
import { clearGallery } from "@/lib/post-gallery";
import { slugify, uniqueSlug } from "@/lib/slug";

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

    const slug = slugify(input.slug || input.title, `post-${randomUUID().slice(0, 8)}`);
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

export interface PostCreate {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  readTime: number;
  sourceUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
}

/** Создаёт материал и возвращает его id; правила те же, что при правке. */
export async function insertPost(input: PostCreate): Promise<string> {
  return withTransaction(async (tx) => {
    if (input.isFeatured && !input.isPublished) {
      throw new PostRuleError("В избранное можно добавить только опубликованный материал.", "featured_needs_publish");
    }

    const id = randomUUID();
    const slug = await uniqueSlug(
      input.slug || input.title,
      async (candidate) => (await tx.rows(`select 1 from posts where slug = ? limit 1`, [candidate])).length > 0,
      "post",
      id,
    );
    const now = new Date().toISOString();

    if (input.isFeatured) {
      await tx.run(`update posts set is_featured = 0, updated_at = ? where is_featured = 1`, [now]);
    }

    await tx.run(
      `insert into posts (id, title, slug, excerpt, content, read_time, source, source_url, is_featured,
         is_published, published_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        slug,
        input.excerpt,
        input.content,
        Math.min(Math.max(Math.trunc(input.readTime) || 5, 1), 60),
        input.sourceUrl,
        input.isFeatured ? 1 : 0,
        input.isPublished ? 1 : 0,
        input.isPublished ? now : null,
        now,
        now,
      ],
    );
    return id;
  });
}

export async function deletePost(postId: string): Promise<void> {
  if (!(await rows<{ id: string }>(`select id from posts where id = ?`, [postId])).length) {
    throw new PostRuleError("Материал не найден.", "not_found");
  }
  // Галерею снимаем до удаления поста: каскад убрал бы строки posts_rels, но
  // не файлы, и в public/uploads остались бы сироты.
  await clearGallery(postId);
  await run(`delete from posts where id = ?`, [postId]);
}
