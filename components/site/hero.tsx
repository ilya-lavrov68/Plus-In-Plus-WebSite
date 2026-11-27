import { Hero138 } from "@/components/blocks/hero138";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * Первый экран студии — имя и действия.
 *
 * Описание студии живёт в следующей секции: на первом экране только заголовок
 * и две кнопки, как на сайтах Google и JetBrains.
 */
export async function Hero() {
  const t = await getRequestTranslations("home");
  const hero = await getRequestTranslations("hero");
  return (
    <Hero138
      headingMuted={t("heroMuted")}
      headingPrimary={t("heroPrimary")}
      primaryCta={{ label: hero("startProject"), href: "/contact" }}
      secondaryCta={{ label: hero("viewWork"), href: "/work" }}
    />
  );
}
