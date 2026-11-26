import type { Metadata } from "next";

import { WorkCaseView } from "@/components/site/work-case-view";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getWorkCase, WORK_CASES } from "@/lib/work-cases";

export const dynamic = "force-dynamic";

interface WorkCasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: WorkCasePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const item = getWorkCase(slug);
  if (!item) return { title: "404" };

  const content = item.content[locale === "ru" ? "ru" : "en"];
  return createPageMetadata({
    title: `${content.title} — ${content.discipline}`,
    description: content.summary,
    path: `/work/${item.slug}`,
    locale,
  });
}

export function generateStaticParams() {
  return WORK_CASES.map((item) => ({ slug: item.slug }));
}

export default async function WorkCasePage({ params }: WorkCasePageProps) {
  const { slug } = await params;
  return <WorkCaseView slug={slug} />;
}
