import type { Metadata } from "next";

import { ServicesCatalogView } from "@/components/site/services-catalog-view";
import { getActiveServices } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizePublicServices } from "@/lib/service-localization";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  return createPageMetadata({
    title: t("services"),
    description: t("servicesDescription"),
    path: "/services",
    locale,
  });
}

export default async function ServicesPage() {
  const [rawServices, locale] = await Promise.all([
    getActiveServices(),
    getRequestLocale(),
  ]);
  const services = localizePublicServices(rawServices, locale);

  const smallServices = services.filter((s) => s.category === "small");
  const largeServices = services.filter((s) => s.category === "large");

  return (
    <ServicesCatalogView
      smallServices={smallServices}
      largeServices={largeServices}
    />
  );
}
