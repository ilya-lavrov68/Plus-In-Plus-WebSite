import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CartView } from "@/components/site/cart-view";
import { auth } from "@/auth";
import { getCart } from "@/lib/cart";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Корзина — обычная страница, а не модальное окно: в неё ведёт иконка в
 * шапке рядом с аватаркой. Состав и суммы считает сервер (lib/cart.ts),
 * интерактив — клиентский CartView.
 */
export default async function CartPage() {
  const [session, t] = await Promise.all([auth(), getRequestTranslations("cart")]);
  if (!session?.user?.id) redirect("/?auth=login");

  const cart = await getCart();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-10">
        <CartView lines={cart.lines} totalEstimate={cart.totalEstimate} currency={cart.currency} />
      </div>
    </div>
  );
}
