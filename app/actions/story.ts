"use server";

import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { normalizeStoryContent, STORY_SETTING_KEY } from "@/lib/story-content";

export interface StoryActionResult {
  ok: boolean;
  error?: string;
}

/** Administrators and founders edit public content; managers never reach this action. */
export async function updateStoryContent(input: unknown): Promise<StoryActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };

  const content = normalizeStoryContent(input);
  if (!content) return { ok: false, error: t("invalidStory") };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: STORY_SETTING_KEY },
        update: { value: JSON.stringify(content) },
        create: { key: STORY_SETTING_KEY, value: JSON.stringify(content) },
      });
      await recordActivity(tx, {
        action: "updated",
        entityType: "setting",
        entityId: STORY_SETTING_KEY,
        title: "Landing story",
        actorId: admin.id,
      });
    });

    revalidatePath("/");
    revalidatePath("/admin/story");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update landing story:", error);
    return { ok: false, error: t("storySaveFailed") };
  }
}
