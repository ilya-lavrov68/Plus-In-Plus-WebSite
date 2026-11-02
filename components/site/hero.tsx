import { Hero138 } from "@/components/blocks/hero138";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function Hero() {
  const t = await getRequestTranslations("home");
  const hero = await getRequestTranslations("hero");
  return (
    <Hero138
      eyebrow={t("heroEyebrow")}
      headingMuted={t("heroMuted")}
      headingPrimary={t("heroPrimary")}
      headingAccent={t("heroAccent")}
      descriptionLead={t("heroDescriptionLead")}
      descriptionStrong={t("heroDescriptionStrong")}
      primaryCta={{ label: hero("orderDesign"), href: "/services" }}
      secondaryCta={{ label: hero("exploreAi"), href: "/ai" }}
      footnote={t("heroFootnote")}
    />
  );
}
