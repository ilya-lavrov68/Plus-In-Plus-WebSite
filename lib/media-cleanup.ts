import { getPayloadClient } from "@/lib/payload-native";
import { cleanupUpload } from "@/lib/uploads";

/** Файл удаляется только после committed mutation и проверки оставшихся ссылок. */
export async function cleanupServiceCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath) return;
  try {
    const payload = await getPayloadClient();
    const references = await payload.count({ collection: "services", overrideAccess: true, where: { coverImage: { equals: publicPath } } });
    if (references.totalDocs === 0) await cleanupUpload(publicPath, "services");
  } catch (error) {
    console.error("Service cover reference check failed; preserving the upload:", error);
  }
}

export async function cleanupPostCoverIfUnused(publicPath: string | null): Promise<void> {
  if (!publicPath) return;
  try {
    const payload = await getPayloadClient();
    const references = await payload.count({ collection: "posts", overrideAccess: true, where: { coverImage: { equals: publicPath } } });
    if (references.totalDocs > 0) return;
    const posts = await payload.find({ collection: "posts", depth: 1, pagination: false, overrideAccess: true });
    const galleryUsesPath = posts.docs.some((post: any) => (post.gallery ?? []).some((media: any) => (typeof media === "object" ? media.url : null) === publicPath));
    if (!galleryUsesPath) await cleanupUpload(publicPath, "blog");
  } catch (error) {
    console.error("Post cover reference check failed; preserving the upload:", error);
  }
}
