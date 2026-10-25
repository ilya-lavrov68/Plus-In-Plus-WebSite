import { prisma } from "@/lib/prisma";
import {
  createEmptyStoryContent,
  parseStoredStoryContent,
  STORY_SETTING_KEY,
  type StoryContent,
} from "@/lib/story-content";

/** Public landing content is database-authoritative and contains no milestone presets. */
export async function getStoryContent(): Promise<StoryContent> {
  if (!prisma) return createEmptyStoryContent();

  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: STORY_SETTING_KEY },
      select: { value: true },
    });
    return parseStoredStoryContent(row?.value);
  } catch (error) {
    console.error("Failed to load landing story:", error);
    return createEmptyStoryContent();
  }
}
