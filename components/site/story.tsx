import { StoryTimeline } from "@/components/site/story-timeline";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getStoryContent } from "@/lib/story";

export async function Story() {
  const [content, t] = await Promise.all([getStoryContent(), getRequestTranslations("story")]);

  return (
    <StoryTimeline
      heading={content.heading || t("heading")}
      description={content.description || t("description")}
      events={content.events}
      labels={{
        eyebrow: t("eyebrow"),
        timelineLabel: t("timelineLabel"),
        emptyTitle: t("emptyTitle"),
        emptyDescription: t("emptyDescription"),
      }}
    />
  );
}
