import { StoryForm } from "@/components/admin/story-form";
import { getAdminStoryContent } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminStoryPage() {
  const [content, t] = await Promise.all([getAdminStoryContent(), getRequestTranslations("admin")]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("story")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("storySubtitle")}</p>
      </div>
      <StoryForm initial={content} />
    </div>
  );
}
