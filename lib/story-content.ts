import { z } from "zod";

/** Stored in the existing SiteSetting table; no schema migration is required. */
export const STORY_SETTING_KEY = "landingStory";

export const STORY_CONTENT_LIMITS = {
  heading: 120,
  description: 600,
  events: 20,
  period: 48,
  eventTitle: 160,
  eventDescription: 1000,
} as const;

const singleLine = (maximum: number, minimum = 0) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));

const multiline = (maximum: number, minimum = 0) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    // Newlines and tabs are valid in descriptions; other control characters are not.
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));

export const storyEventSchema = z
  .object({
    id: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
    period: singleLine(STORY_CONTENT_LIMITS.period, 1),
    title: singleLine(STORY_CONTENT_LIMITS.eventTitle, 1),
    description: multiline(STORY_CONTENT_LIMITS.eventDescription, 1),
  })
  .strict();

export const storyContentSchema = z
  .object({
    heading: singleLine(STORY_CONTENT_LIMITS.heading),
    description: multiline(STORY_CONTENT_LIMITS.description),
    events: z.array(storyEventSchema).max(STORY_CONTENT_LIMITS.events),
  })
  .strict()
  .superRefine((content, context) => {
    const ids = new Set<string>();
    content.events.forEach((event, index) => {
      if (ids.has(event.id)) {
        context.addIssue({
          code: "custom",
          message: "Story event IDs must be unique.",
          path: ["events", index, "id"],
        });
      }
      ids.add(event.id);
    });
  });

export type StoryEvent = z.infer<typeof storyEventSchema>;
export type StoryContent = z.infer<typeof storyContentSchema>;

export function createEmptyStoryContent(): StoryContent {
  return { heading: "", description: "", events: [] };
}

/** Validates both browser submissions and data read back from the database. */
export function normalizeStoryContent(input: unknown): StoryContent | null {
  const result = storyContentSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** A malformed CMS value fails closed to an empty state, never to invented milestones. */
export function parseStoredStoryContent(value: string | null | undefined): StoryContent {
  if (!value) return createEmptyStoryContent();
  try {
    return normalizeStoryContent(JSON.parse(value)) ?? createEmptyStoryContent();
  } catch {
    return createEmptyStoryContent();
  }
}
