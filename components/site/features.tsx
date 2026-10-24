import { Feature314 } from "@/components/blocks/feature314";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function Features() {
  const t = await getRequestTranslations("features");
  return (
    <Feature314
      heading={t("heading")}
      button={{ text: t("button"), url: "/contact" }}
      smallCards={[
        { topNote: t("confidential.title"), title: t("confidential.title"), summary: t("confidential.description"), url: "/contact" },
        { topNote: t("individual.title"), title: t("individual.title"), summary: t("individual.description"), url: "/services" },
      ]}
      bigCard={{ label: "Plus In Plus®", title: t("support.title"), summary: t("support.description"), url: "/contact" }}
    />
  );
}
