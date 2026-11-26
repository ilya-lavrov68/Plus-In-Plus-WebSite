import type { Metadata } from "next";

import { WorkIndex } from "@/components/site/work-index";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getRequestLocale(), getRequestTranslations("metadata")]);
  return createPageMetadata({
    title: t("work"),
    description: t("workDescription"),
    path: "/work",
    locale,
  });
}

export default function WorkPage() {
  return <WorkIndex />;
}
