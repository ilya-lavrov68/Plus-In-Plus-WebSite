import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPublishedService } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeCatalogService } from "@/lib/service-localization";
import { resolveServiceBySlug } from "@/lib/studio-catalog";
import ServiceContent from "./content";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [dbService, locale, tMeta] = await Promise.all([
    getPublishedService(slug),
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  const resolved = resolveServiceBySlug(slug, dbService);
  if (!resolved) redirect("/services");
  const service = localizeCatalogService(resolved, locale);

  return createPageMetadata({
    title: `${service.title} — Plus In Plus`,
    description: service.shortDesc || tMeta("servicesDescription"),
    path: `/shop/${encodeURIComponent(slug)}`,
    image: service.coverImage,
    locale,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;

  // A loading/Suspense boundary here would stream a 200 shell before an
  // unknown service can issue its redirect.
  return ServiceContent({ slug });
}
