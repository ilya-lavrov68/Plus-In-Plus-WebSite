import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Заказы и корзина объединены: отдельной страницы заказов больше нет,
 * `/orders` ведёт на `/cart`, где живёт и корзина, и список заказов.
 * Редирект сохранён ради старых ссылок, возврата с оплаты и писем.
 */
export default function OrdersPage() {
  redirect("/cart");
}
