import { PwHeader } from "@/components/pw/header";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * Шапка сайта в структуре payloadcms.com: строка-объявление, панель навигации,
 * утилиты (корзина, вход) и CTA. SHOP остаётся в меню как каталог услуг.
 */
export async function Navbar() {
  const [t, locale] = await Promise.all([
    getRequestTranslations("shell"),
    getRequestLocale(),
  ]);

  return (
    <PwHeader
      locale={locale === "en" ? "en" : "ru"}
      topBar={t("topBar")}
      menuLabel={t("menu")}
      closeLabel={t("close")}
      links={[
        {
          label: t("nav.services"),
          href: "/services",
          children: [
            { label: t("nav.services"), href: "/services", description: "Айдентика, макеты и вывески под ключ." },
            { label: t("nav.shop"), href: "/shop", description: "Каталог носителей и заказ производства." },
          ],
        },
        { label: t("nav.shop"), href: "/shop" },
        { label: t("nav.blog"), href: "/blog" },
        {
          label: t("nav.ai"),
          href: "/ai",
          children: [
            { label: "Lumi Q1", href: "/ai/lumi", description: "Агент для кода и инженерных задач." },
            { label: "Kairo", href: "/ai/kairo", description: "Агент для документов и права." },
          ],
        },
        { label: t("nav.contact"), href: "/contact" },
      ]}
      utility={[
        { label: t("utility.cart"), href: "/cart" },
        { label: t("utility.login"), href: "/login" },
      ]}
      cta={{ label: t("cta"), href: "/contact" }}
    />
  );
}
