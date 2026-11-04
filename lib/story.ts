import { rows } from "@/lib/db";
import {
  createEmptyStoryContent,
  normalizeStoryContent,
  type StoryContent,
} from "@/lib/story-content";

/** Public landing content is database-authoritative and contains no milestone presets. */
export async function getStoryContent(): Promise<StoryContent> {
  try {
    // Global-документ `story` и его события читаются двумя запросами.
    const [story] = await rows<{ id: string; heading: string | null; description: string | null }>(
      `select id, heading, description from story order by created_at limit 1`,
    );
    const events = story
      ? await rows<{ id: string; period: string; title: string; description: string }>(
          `select id, period, title, description from story_events where _parent_id = ? order by "_order"`,
          [story.id],
        )
      : [];
    return normalizeStoryContent({
      heading: story?.heading ?? "",
      description: story?.description ?? "",
      events: events.map((event) => ({
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
