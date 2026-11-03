import { rows, run } from "@/lib/db";
import { deleteImageUpload } from "@/lib/uploads";

/**
 * Медиатека панели: список загруженных файлов и их использование.
 *
 * Удалять файл можно только пока на него никто не ссылается — иначе у услуги
 * или материала останется битая ссылка. Проверка идёт по всем местам, где
 * хранится ссылка: обложки услуг, товаров и материалов плюс галереи постов.
 */

export interface MediaItem {
  id: string;
  url: string;
  kind: string;
  alt: string;
  mimeType: string | null;
  filesize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  usageCount: number;
}

export class MediaRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "MediaRuleError";
  }
}

const USAGE_SQL = `
  (select count(*) from services s where s.cover_image = m.url)
  + (select count(*) from products p where p.cover_image = m.url)
  + (select count(*) from posts po where po.cover_image = m.url)
  + (select count(*) from posts_rels r where r.media_id = m.id)`;

export async function listMedia(limit = 60): Promise<MediaItem[]> {
  const found = await rows<{
    id: string;
    url: string | null;
    kind: string;
    alt: string;
    mime_type: string | null;
    filesize: number | null;
    width: number | null;
    height: number | null;
    created_at: string | null;
    usage_count: number;
  }>(
    `select m.id, m.url, m.kind, m.alt, m.mime_type, m.filesize, m.width, m.height, m.created_at,
       ${USAGE_SQL} usage_count
     from media m
     where m.url is not null
     order by m.created_at desc, m.id desc
     limit ?`,
    [Math.min(Math.max(Math.trunc(limit) || 60, 1), 200)],
  );

  return found.map((row) => ({
    id: row.id,
    url: String(row.url),
    kind: String(row.kind ?? "general"),
    alt: String(row.alt ?? ""),
    mimeType: row.mime_type ?? null,
    filesize: Number(row.filesize ?? 0),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    createdAt: String(row.created_at ?? ""),
    usageCount: Number(row.usage_count ?? 0),
  }));
}

export async function usageCountFor(mediaId: string): Promise<number> {
  const [row] = await rows<{ usage_count: number }>(
    `select ${USAGE_SQL} usage_count from media m where m.id = ?`,
    [mediaId],
  );
  return Number(row?.usage_count ?? 0);
}

/**
 * Удаляет файл из медиатеки. Используемый файл не трогаем: сначала админ
 * убирает ссылку в карточке, потом файл можно удалить здесь.
 */
export async function deleteMedia(mediaId: string): Promise<void> {
  const [media] = await rows<{ id: string; url: string | null; kind: string }>(
    `select id, url, kind from media where id = ?`,
    [mediaId],
  );
  if (!media) throw new MediaRuleError("Файл не найден.", "not_found");

  if ((await usageCountFor(mediaId)) > 0) {
    throw new MediaRuleError("Файл используется в услуге, товаре или материале — сначала уберите ссылку.", "in_use");
  }

  // `deleteImageUpload` убирает и строку, и файл — но только если kind в
  // media совпадает с ожидаемым. Строку всё равно удаляем явно: файл мог быть
  // загружен до появления таблицы media.
  if (media.url) {
    const kind = media.kind === "avatars" || media.kind === "blog" ? media.kind : "services";
    await deleteImageUpload(media.url, kind);
  }
  await run(`delete from media where id = ?`, [mediaId]);
}
