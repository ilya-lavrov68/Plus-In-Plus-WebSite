import type { Metadata } from "next";

import { AgentTechnologyPage } from "@/components/ai/agent-technology-page";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("agentPages"),
  ]);

  return createPageMetadata({
    title: t("kairo.metaTitle"),
    description: t("kairo.metaDescription"),
    path: "/ai/kairo",
    locale,
  });
}

export default function KairoPage() {
  return <AgentTechnologyPage agent="kairo" />;
}
