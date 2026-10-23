import type { Metadata } from "next";

import { Contact29 } from "@/components/blocks/contact29";
import { getPublishedServices } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { mergeCatalogServices } from "@/lib/studio-catalog";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getRequestLocale(), getRequestTranslations("metadata")]);
  return createPageMetadata({
    title: t("contact"),
    description: t("contactDescription"),
    path: "/contact",
    locale,
  });
}

interface ContactPageProps {
  searchParams?: Promise<{ service?: string }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [params, dbServices, t] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    getPublishedServices(),
    getRequestTranslations("contact"),
  ]);

  const services = mergeCatalogServices(dbServices);

  return (
    <Contact29
      title={t("title")}
      services={services}
      initialService={params?.service}
    />
  );
}
