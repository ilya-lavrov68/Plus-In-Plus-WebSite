import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * Страница /shop.
 *
 * Раздел временно отключён до появления мерча: из навигации он убран, а по
 * прямой ссылке показывается заглушка. Страницы отдельных услуг
 * (/shop/[slug]) продолжают работать — именно через их конфигуратор клиент
 * отправляет заявку на расчёт, поэтому этот маршрут не трогаем.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getRequestTranslations("shop");
  return {
    ...createPageMetadata({
      title: t("comingSoonTitle"),
      description: t("comingSoonBody"),
      path: "/shop",
      locale,
    }),
    // Заглушке в поисковой выдаче делать нечего.
    robots: { index: false, follow: true },
  };
}

export default async function ShopComingSoonPage() {
  const t = await getRequestTranslations("shop");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("comingSoonTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
          {t("comingSoonBody")}
        </p>
        <Button asChild className="mt-8">
          <Link href="/">{t("comingSoonBack")}</Link>
        </Button>
      </div>
    </div>
  );
}
