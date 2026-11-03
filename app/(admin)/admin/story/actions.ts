"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { saveStory, StoryRuleError } from "@/lib/story-editor";

/**
 * Сохранение блока «история». Вехи приходят нумерованными полями формы:
 * `event-<index>-period`, `event-<index>-title`, `event-<index>-description`.
 */
export async function saveStoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const events: Array<{ id?: string; period: string; title: string; description: string }> = [];
  for (let index = 0; index < 20; index += 1) {
    const id = String(formData.get(`event-${index}-id`) ?? "").trim();
    const period = String(formData.get(`event-${index}-period`) ?? "");
    const title = String(formData.get(`event-${index}-title`) ?? "");
    const description = String(formData.get(`event-${index}-description`) ?? "");
    if (!period.trim() && !title.trim() && !description.trim()) continue;
    events.push({ id: id || undefined, period, title, description });
  }

  try {
    await saveStory({
      heading: String(formData.get("heading") ?? ""),
      description: String(formData.get("description") ?? ""),
      events,
    });
  } catch (error) {
    if (error instanceof StoryRuleError) {
      redirect(`/admin/story?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  await logAdminAction({
    action: "story.updated",
    entityType: "story",
    entityId: "story",
    title: `История: вех ${events.length}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/story");
  revalidatePath("/");
  redirect("/admin/story?saved=1");
}
