import { Cta13 } from "@/components/blocks/cta13";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function CtaSection() {
  const [t, hero] = await Promise.all([
    getRequestTranslations("home"),
    getRequestTranslations("hero"),
  ]);
  // Главный сценарий сайта — бриф: акцентная кнопка ведёт на форму заявки,
  // а услуги и продукт остаются вторичными действиями.
  return (
    <Cta13
      heading={t("ctaTitle")}
      description={t("ctaDescription")}
      primaryButton={{ text: hero("startProject"), url: "/contact" }}
      secondaryButton={{ text: hero("exploreProduct"), url: "/line-launcher" }}
    />
  );
}
