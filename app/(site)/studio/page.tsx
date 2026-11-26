import type { Metadata } from "next";

import { StudioView } from "@/components/site/studio-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getRequestLocale(), getRequestTranslations("metadata")]);
  return createPageMetadata({
    title: t("studio"),
    description: t("studioDescription"),
    path: "/studio",
    locale,
  });
}

export default function StudioPage() {
  return <StudioView />;
}
