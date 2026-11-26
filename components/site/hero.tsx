import { Hero138 } from "@/components/blocks/hero138";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * Первый экран студии — только типографика и действия.
 *
 * Ни сцены, ни шейдера, ни карусели работ: крупный заголовок, спокойное
 * описание и два действия. Работы начинаются ниже, отдельной секцией.
 */
export async function Hero() {
  const t = await getRequestTranslations("home");
  const hero = await getRequestTranslations("hero");
  return (
    <Hero138
      headingMuted={t("heroMuted")}
      headingPrimary={t("heroPrimary")}
      descriptionLead={t("heroDescriptionLead")}
      descriptionStrong={t("heroDescriptionStrong")}
      primaryCta={{ label: hero("startProject"), href: "/contact" }}
      secondaryCta={{ label: hero("viewWork"), href: "/work" }}
      footnote={t("heroFootnote")}
    />
  );
}
