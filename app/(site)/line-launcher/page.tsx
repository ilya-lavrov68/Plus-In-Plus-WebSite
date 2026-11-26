import type { Metadata } from "next";

import { LineLauncherView } from "@/components/site/line-launcher-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  return createPageMetadata({
    title: t("lineLauncher"),
    description: t("lineLauncherDescription"),
    path: "/line-launcher",
    locale,
  });
}

export default async function LineLauncherPage() {
  return <LineLauncherView />;
}
