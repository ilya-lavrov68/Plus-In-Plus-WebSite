import { rows } from "@/lib/db";
import { cleanupUpload } from "@/lib/uploads";

/**
 * Файл удаляется только после committed mutation и повторной проверки ссылок:
 * картинка может использоваться в другой услуге, обложке поста или галерее.
 */
async function referenced(path: string): Promise<boolean> {
  const found = await rows<{ total: number }>(
    `select (select count(*) from services where cover_image = ?)
          + (select count(*) from posts where cover_image = ?)
          + (select count(*) from posts_rels r join media m on m.id = r.media_id where m.url = ?) total`,
    [path, path, path],
  );
  return Number(found[0]?.total ?? 0) > 0;
}

export async function cleanupServiceCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath) return;
  try {
    if (!(await referenced(publicPath))) await cleanupUpload(publicPath, "services");
  } catch (error) {
    console.error("Service cover reference check failed; preserving the upload:", error);
  }
}

export async function cleanupPostCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath) return;
  try {
    if (!(await referenced(publicPath))) await cleanupUpload(publicPath, "blog");
  } catch (error) {
    console.error("Post cover reference check failed; preserving the upload:", error);
  }
}
