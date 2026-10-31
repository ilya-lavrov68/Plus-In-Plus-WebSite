import type { Metadata } from "next";

import { ContactOrderForm } from "@/components/site/contact-order-form";
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
    title: t("contact"),
    description: t("contactDescription"),
    path: "/contact",
    locale,
  });
}

interface ContactPageProps {
  searchParams?: Promise<{ service?: string; services?: string }>;
}

const SLUG_ALIAS: Record<string, string> = {
  "large-billboard": "large-billboard-building",
  "advertisement-on-the-fence": "advertisement-fence",
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [params, rawServices, locale] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    getActiveServices(),
    getRequestLocale(),
  ]);

  const activeServices = localizePublicServices(rawServices, locale);

  const rawTokens = [
    ...(params?.services ? params.services.split(",") : []),
    ...(params?.service ? [params.service] : []),
  ]
    .map((token) => token.trim())
    .filter(Boolean);

  const initialSelectedIds = Array.from(
    new Set(
      rawTokens
        .map((token) => {
          const normalized = SLUG_ALIAS[token] ?? token;
          const match = activeServices.find(
            (svc) =>
              svc.id === token ||
              svc.slug === token ||
              svc.slug === normalized
          );
          return match?.id ?? null;
        })
        .filter((id): id is string => Boolean(id))
    )
  );

  return (
    <ContactOrderForm
      initialServices={activeServices}
      initialSelectedIds={initialSelectedIds}
    />
  );
}
