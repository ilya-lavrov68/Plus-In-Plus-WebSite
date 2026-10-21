import type { Metadata } from "next";

import { Contact29 } from "@/components/blocks/contact29";
import { getPublishedServices } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";
import { mergeCatalogServices } from "@/lib/studio-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Contact us — Plus In Plus",
    description:
      "Have an idea for signage, web mockups, or outdoor media? Send a message to Plus In Plus.",
    path: "/contact",
    locale,
  });
}

interface ContactPageProps {
  searchParams?: Promise<{ service?: string }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [params, dbServices] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    getPublishedServices(),
  ]);

  const services = mergeCatalogServices(dbServices);

  return (
    <Contact29
      title="Contact us"
      services={services}
      initialService={params?.service}
    />
  );
}
