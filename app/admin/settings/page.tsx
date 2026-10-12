import { Settings } from "lucide-react";

import { SettingsForm } from "@/components/admin/settings-form";
import { EmptyState } from "@/components/site/empty-state";
import { getFeaturedCandidates, getSiteSettings } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, posts, t] = await Promise.all([
    getSiteSettings(),
    getFeaturedCandidates(),
    getRequestTranslations("admin"),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("settings")}</h1>
      <p className="mt-2 text-muted-foreground">{t("settingsSubtitle")}</p>
      <div className="mt-8"><SettingsForm initial={settings} posts={posts} /></div>
      {!posts.length ? <div className="mt-8"><EmptyState icon={Settings} title={t("noPublishedPosts")} description={t("publishPostToFeature")} /></div> : null}
    </div>
  );
}
