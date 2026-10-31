import { getPayloadClient } from "@/lib/payload-native";
import {
  createEmptyStoryContent,
  normalizeStoryContent,
  type StoryContent,
} from "@/lib/story-content";

/** Public landing content is database-authoritative and contains no milestone presets. */
export async function getStoryContent(): Promise<StoryContent> {
  try {
    const payload = await getPayloadClient();
    const story = await payload.findGlobal({ slug: "story", depth: 0, overrideAccess: true });
    return normalizeStoryContent({
      heading: story.heading ?? "",
      description: story.description ?? "",
      events: (story.events ?? []).map((event) => ({
        id: String(event.id),
        period: event.period,
        title: event.title,
        description: event.description,
      })),
    }) ?? createEmptyStoryContent();
  } catch (error) {
    console.error("Failed to load landing story:", error);
    return createEmptyStoryContent();
  }
}
