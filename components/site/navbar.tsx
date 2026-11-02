import { SiteHeader } from "@/components/payload/site-header";
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
    <SiteHeader
      locale={locale === "en" ? "en" : "ru"}
      topBar={t("topBar")}
      menuLabel={t("menu")}
      closeLabel={t("close")}
      links={[
        { label: t("nav.services"), href: "/services" },
        { label: t("nav.shop"), href: "/shop" },
        { label: t("nav.blog"), href: "/blog" },
        { label: t("nav.ai"), href: "/ai" },
        { label: t("nav.studio"), href: "/story" },
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
