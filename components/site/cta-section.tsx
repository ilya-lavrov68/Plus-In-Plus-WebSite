import { Cta13 } from "@/components/blocks/cta13";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function CtaSection() {
  const [t, hero] = await Promise.all([
    getRequestTranslations("home"),
    getRequestTranslations("hero"),
  ]);
  return (
    <Cta13
      heading={t("ctaTitle")}
      description={t("ctaDescription")}
      primaryButton={{ text: hero("orderDesign"), url: "/services" }}
      secondaryButton={{ text: hero("exploreAi"), url: "/ai" }}
    />
  );
}
