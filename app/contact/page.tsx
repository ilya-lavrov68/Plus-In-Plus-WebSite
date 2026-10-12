import type { Metadata } from "next";

import { ContactForm } from "@/components/site/contact-form";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: t("contact"),
    description: t("contactDescription"),
    path: "/contact",
    locale,
  });
}

export default async function ContactPage() {
  const t = await getRequestTranslations("contact");
  return (
    <>
      <InternalPageHeader title={t("pageTitle")} />

      <InternalPageContent labelledBy="contact-heading" sectionClassName="pt-12 sm:pt-16 lg:pt-20">
        <h2 id="contact-heading" className="text-center font-geist text-3xl font-semibold tracking-[-0.04em] text-[#052B42] sm:text-4xl">
          {t("title")}
        </h2>
        <div className="mt-8 sm:mt-10">
          <ContactForm />
        </div>
      </InternalPageContent>
    </>
  );
}
