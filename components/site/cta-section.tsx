import { Cta13 } from "@/components/blocks/cta13";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function CtaSection() {
  const t = await getRequestTranslations("home");
  return (
    <Cta13
      heading={t("ctaTitle")}
      description={t("ctaDescription")}
      // Один CTA без пары-дубля: hero уже ведёт в /services и /ai,
      // поэтому финальный блок предлагает другой шаг — обсудить задачу.
      primaryButton={{ text: t("ctaButton"), url: "/contact" }}
    />
  );
}
