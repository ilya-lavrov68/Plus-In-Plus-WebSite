import type { Metadata } from "next";

import block from "@/components/pw/blocks/block-wrapper.module.scss";
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
  const [rawServices, locale, t] = await Promise.all([
    getActiveServices(),
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  const services = localizePublicServices(rawServices, locale);

  const smallServices = services.filter((s) => s.category === "small");
  const largeServices = services.filter((s) => s.category === "large");

  return (
    <>
      <div className={block.blockWrapper} style={{ paddingTop: "calc(var(--header-height) * 0.6)", paddingBottom: "2rem" }}>
        <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
          <div className="cols-8 cols-m-8">
            <p className="pl-h6">Plus In Plus</p>
            <h1 className="pl-h1">{t("services")}</h1>
            <p>{t("servicesDescription")}</p>
          </div>
        </div>
      </div>
      <ServicesCatalogView
        smallServices={smallServices}
        largeServices={largeServices}
      />
    </>
  );
}
