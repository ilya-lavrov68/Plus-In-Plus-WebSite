import { rows, run, withTransaction } from "@/lib/db";
import { cleanupGalleryImageIfUnused } from "@/lib/media-cleanup";
import { saveAlbumImage } from "@/lib/uploads";

/**
 * Галерея материала: строки `posts_rels` со ссылкой на `media`.
 *
 * Публичная страница читает её запросом `posts_rels r join media m` и
 * сортирует по `order`; здесь тот же контракт, поэтому порядок, который
 * админ видит в панели, совпадает с порядком на странице.
 */

export const GALLERY_PATH = "images";
export const MAX_GALLERY_IMAGES = 12;

export interface GalleryImage {
  mediaId: string;
  url: string;
  position: number;
}

export class GalleryRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "GalleryRuleError";
  }
}

export async function listGallery(postId: string): Promise<GalleryImage[]> {
  const found = await rows<{ media_id: string; url: string; position: number }>(
    `select r.media_id, m.url, coalesce(r."order", 0) position
       from posts_rels r join media m on m.id = r.media_id
      where r.parent_id = ? order by coalesce(r."order", 0), r.id`,
    [postId],
  );
  return found.map((row) => ({ mediaId: row.media_id, url: row.url, position: Number(row.position) }));
}

/** Добавляет файлы в конец галереи. Возвращает ссылки загруженных картинок. */
export async function appendGalleryImages(postId: string, files: File[]): Promise<string[]> {
  const images = files.filter((file) => file.size > 0);
  if (images.length === 0) return [];

  const existing = await listGallery(postId);
  if (existing.length + images.length > MAX_GALLERY_IMAGES) {
    throw new GalleryRuleError(`В галерее не может быть больше ${MAX_GALLERY_IMAGES} изображений.`, "too_many");
  }

  const uploaded: Array<{ mediaId: string; url: string }> = [];
  try {
    for (const file of images) {
      const url = await saveAlbumImage(file);
      const [media] = await rows<{ id: string }>(`select id from media where url = ? order by created_at desc limit 1`, [url]);
      if (!media) throw new Error("media row missing after upload");
      uploaded.push({ mediaId: media.id, url });
    }
  } catch (error) {
    // Неудачная загрузка не должна оставлять файлы-сироты в public/uploads.
    for (const item of uploaded) await cleanupGalleryImageIfUnused(item.url);
    throw error;
  }

  await withTransaction(async (tx) => {
    let position = existing.reduce((max, image) => Math.max(max, image.position), 0);
    for (const item of uploaded) {
      position += 1;
      await tx.run(
        `insert into posts_rels ("order", parent_id, path, media_id) values (?, ?, ?, ?)`,
        [position, postId, GALLERY_PATH, item.mediaId],
      );
    }
  });

  return uploaded.map((item) => item.url);
}

/** Убирает изображение из галереи и удаляет файл, если на него больше нет ссылок. */
export async function removeGalleryImage(postId: string, mediaId: string): Promise<void> {
  const [target] = await rows<{ url: string | null }>(
    `select m.url from posts_rels r left join media m on m.id = r.media_id
      where r.parent_id = ? and r.media_id = ? limit 1`,
    [postId, mediaId],
  );
  await run(`delete from posts_rels where parent_id = ? and media_id = ?`, [postId, mediaId]);
  if (target?.url) await cleanupGalleryImageIfUnused(target.url);
}

/** Удаляет галерею вместе с материалами — вызывается при удалении поста. */
export async function clearGallery(postId: string): Promise<void> {
  const images = await listGallery(postId);
  await run(`delete from posts_rels where parent_id = ?`, [postId]);
  for (const image of images) await cleanupGalleryImageIfUnused(image.url);
}
