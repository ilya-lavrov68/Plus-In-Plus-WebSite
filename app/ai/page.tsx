import type { Metadata } from "next";

import { AiPageView } from "@/components/ai/ai-page-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);

  return createPageMetadata({
    title: t("ai"),
    description: t("aiDescription"),
    path: "/ai",
    locale,
  });
}

export default function AiPage() {
  return <AiPageView />;
}
