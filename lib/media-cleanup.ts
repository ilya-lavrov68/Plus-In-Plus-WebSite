import { prisma } from "@/lib/prisma";
import { cleanupUpload } from "@/lib/uploads";

/**
 * Duplicated content deliberately shares upload paths. Delete an old file only
 * after the committed mutation and only when no remaining row references it.
 * If references cannot be checked, preserving the file is the safe outcome.
 */
export async function cleanupServiceCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath || !prisma) return;
  try {
    const references = await prisma.service.count({ where: { coverImage: publicPath } });
    if (references === 0) await cleanupUpload(publicPath, "services");
  } catch (error) {
    console.error("Service cover reference check failed; preserving the upload:", error);
  }
}

export async function cleanupPostCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath || !prisma) return;
  try {
    const references = await prisma.post.count({
      where: {
        OR: [
          { coverImage: publicPath },
          // Albums are JSON-encoded strings in SQLite and may share the cover.
          { images: { contains: publicPath } },
        ],
      },
    });
    if (references === 0) await cleanupUpload(publicPath, "blog");
  } catch (error) {
    console.error("Post cover reference check failed; preserving the upload:", error);
  }
}
