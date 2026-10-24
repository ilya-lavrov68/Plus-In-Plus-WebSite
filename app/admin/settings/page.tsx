import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { SettingsForm } from "@/components/admin/settings-form";
import { EmptyState } from "@/components/site/empty-state";
import { getFeaturedCandidates, getSiteSettings } from "@/lib/admin-data";
import { requireFounder } from "@/lib/admin-session";
import { resolveRobokassaConfig } from "@/lib/payments/robokassa-config";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

/**
 * «Пульт управления» сайтом: студия, SEO, парсеры, платежи и уведомления.
 *
 * Доступ — строго FOUNDER: на этой странице лежат пароли Робокассы и токен
 * Telegram-бота. Обычный админ сюда не попадает ни из меню (ссылка скрыта),
 * ни по прямому адресу (эта проверка), ни через экшен (requireFounder).
 */
export default async function AdminSettingsPage() {
  const founder = await requireFounder();
  if (!founder) redirect("/admin/dashboard");

  const [settings, posts, robokassa, t] = await Promise.all([
    getSiteSettings(),
    getFeaturedCandidates(),
    resolveRobokassaConfig(),
    getRequestTranslations("admin"),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("settings")}</h1>
      <p className="mt-2 text-muted-foreground">{t("settingsSubtitle")}</p>
      <div className="mt-8">
        <SettingsForm
          initial={settings.values}
          secretStatus={settings.secrets}
          posts={posts}
          robokassaSource={robokassa.source}
        />
      </div>
      {!posts.length ? <div className="mt-8"><EmptyState icon={Settings} title={t("noPublishedPosts")} description={t("publishPostToFeature")} /></div> : null}
    </div>
  );
}
