import { Hero138 } from "@/components/blocks/hero138";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function Hero() {
  const t = await getRequestTranslations("home");
  const hero = await getRequestTranslations("hero");
  return (
    <Hero138
      headingMuted={t("heroMuted")}
      headingPrimary={t("heroPrimary")}
      descriptionLead={t("heroDescriptionLead")}
      descriptionStrong={t("heroDescriptionStrong")}
      primaryCta={{ label: hero("order"), href: "/services" }}
      secondaryCta={{ label: hero("contactUs"), href: "/contact" }}
      footnote={t("heroFootnote")}
    />
  );
}
