import { run } from "@/lib/db";
import { cleanupUpload, saveImageUpload, UploadValidationError, type UploadKind } from "@/lib/uploads";

/**
 * Обложки услуг, товаров и материалов.
 *
 * Раньше их принимала медиатека CMS. Здесь тот же путь: файл проходит проверку
 * типа и размера, пережимается в WebP, кладётся в `public/uploads/media` и
 * записывается в строку таблицы `media`, а карточка получает ссылку.
 */

export const COVER_TABLES = {
  services: { table: "services", kind: "services" },
  posts: { table: "posts", kind: "blog" },
  products: { table: "products", kind: "services" },
} as const satisfies Record<string, { table: string; kind: UploadKind }>;

export type CoverSurface = keyof typeof COVER_TABLES;

export function isCoverSurface(value: string): value is CoverSurface {
  return Object.hasOwn(COVER_TABLES, value);
}

/** Пишет ссылку на обложку; строку `media` создаёт `saveImageUpload`. */
export async function setCover(surface: CoverSurface, id: string, coverImage: string | null): Promise<void> {
  const target = COVER_TABLES[surface].table;
  await run(`update ${target} set cover_image = ?, cover_id = null, updated_at = ? where id = ?`, [
    coverImage,
    new Date().toISOString(),
    id,
  ]);
}

export interface CoverChange {
  /** Файл из формы; `null`, если поле пустое. */
  file: File | null;
  /** Галочка «удалить обложку». */
  remove: boolean;
  /** Текущая ссылка (из скрытого поля формы) — её файл удаляется при замене. */
  current: string | null;
}

/**
 * Применяет изменение обложки и возвращает новую ссылку.
 * `undefined` означает «оставить как было».
 */
export async function applyCoverChange(
  surface: CoverSurface,
  id: string,
  change: CoverChange,
): Promise<string | null | undefined> {
  if (change.file && change.file.size > 0) {
    let url: string;
    try {
      url = await saveImageUpload(change.file, COVER_TABLES[surface].kind);
    } catch (error) {
      if (error instanceof UploadValidationError) throw error;
      throw error;
    }
    await setCover(surface, id, url);
    // Старый файл удаляем только после успешной записи новой ссылки.
    await cleanupUpload(change.current, COVER_TABLES[surface].kind);
    return url;
  }

  if (change.remove) {
    await setCover(surface, id, null);
    await cleanupUpload(change.current, COVER_TABLES[surface].kind);
    return null;
  }

  return undefined;
}

/** Читает поле файла из формы: пустой input приходит как файл нулевого размера. */
export function coverFileFrom(formData: FormData, name = "cover"): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
