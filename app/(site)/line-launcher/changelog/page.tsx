import type { Metadata } from "next";

import { ChangelogView } from "@/components/site/changelog-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getRequestTranslations("metadata");
  return createPageMetadata({
    title: t("lineLauncherChangelog"),
    description: t("lineLauncherChangelogDescription"),
    path: "/line-launcher/changelog",
    locale,
  });
}

export default function LineLauncherChangelogPage() {
  return <ChangelogView />;
}
