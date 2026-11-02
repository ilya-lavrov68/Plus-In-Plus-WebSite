import { SiteFooter } from "@/components/payload/site-footer";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getPublicSiteSettings } from "@/lib/public-site-settings";

/**
 * Футер строками, как на payloadcms.com: четыре ряда ссылок вместо
 * пятиколоночной простыни, контакты и нижняя строка с документами.
 */
export async function Footer() {
  const [t, locale, settings] = await Promise.all([
    getRequestTranslations("shell"),
    getRequestLocale(),
    getPublicSiteSettings(),
  ]);

  return (
    <SiteFooter
      locale={locale === "en" ? "en" : "ru"}
      description={settings.studioDescription ?? "Студия ИИ и дизайна: агенты, айдентика, макеты, вывески и оформление мероприятий."}
      contactEmail={settings.contactEmail}
      contactPhone={settings.contactPhone}
      social={[
        { label: "VK", href: settings.vkUrl ?? "https://vk.com/plusinplus" },
        { label: "Telegram", href: settings.telegramUrl ?? "https://t.me/plusinplus" },
        { label: "YouTube", href: settings.youtubeUrl ?? "https://www.youtube.com/@plusinplus" },
      ]}
      groups={[
        {
          title: t("footer.services"),
          links: [
            { label: t("nav.services"), href: "/services" },
            { label: t("nav.shop"), href: "/shop" },
            { label: "Заказать дизайн", href: "/contact" },
          ],
        },
        {
          title: t("footer.studio"),
          links: [
            { label: t("nav.studio"), href: "/story" },
            { label: t("nav.blog"), href: "/blog" },
            { label: t("nav.contact"), href: "/contact" },
          ],
        },
        {
          title: t("footer.resources"),
          links: [
            { label: t("nav.ai"), href: "/ai" },
            { label: "Lumi Q1", href: "/ai/lumi" },
            { label: "Kairo", href: "/ai/kairo" },
          ],
        },
        {
          title: t("footer.legal"),
          links: [
            { label: t("legal.privacy"), href: "/privacy" },
            { label: t("legal.terms"), href: "/terms" },
          ],
        },
      ]}
      legal={[
        { label: t("legal.privacy"), href: "/privacy" },
        { label: t("legal.terms"), href: "/terms" },
      ]}
    />
  );
}
