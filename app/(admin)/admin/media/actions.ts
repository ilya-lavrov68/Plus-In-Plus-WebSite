"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { deleteMedia, MediaRuleError } from "@/lib/media-library";

/**
 * Удаление файла из медиатеки. Только ADMIN/FOUNDER и только для файлов без
 * ссылок: занятый файл сначала нужно отвязать в карточке.
 */
export async function deleteMediaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  try {
    await deleteMedia(id);
  } catch (error) {
    if (error instanceof MediaRuleError) {
      redirect(`/admin/media?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  await logAdminAction({
    action: "media.deleted",
    entityType: "media",
    entityId: id,
    title: `Медиа: ${id}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/media");
  redirect("/admin/media?deleted=1");
}
