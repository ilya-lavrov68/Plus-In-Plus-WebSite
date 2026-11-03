import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { auth } from "@/auth";
import { CartPanel } from "@/components/site/cart-panel";
import { EmptyState } from "@/components/site/empty-state";
import { OrderCard } from "@/components/site/order-card";
import { getCustomerOrders } from "@/lib/customer-orders";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Корзина и заказы — одна страница.
 *
 * Корзина в базе и есть заказ со статусом `cart`, поэтому разделять их по
 * разным адресам смысла нет: наверху то, что ещё не отправлено, ниже — уже
 * отправленные заявки с их статусами, счетами и отменой. `/orders` остаётся
 * редиректом сюда, чтобы старые ссылки и возвраты с оплаты не ломались.
 */
export default async function CartPage() {
  const [session, t, tOrders] = await Promise.all([
    auth(),
    getRequestTranslations("cart"),
    getRequestTranslations("orders"),
  ]);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const orders = await getCustomerOrders();

  return (
    <div className="mx-auto max-w-4xl px-6 section-y">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section aria-labelledby="cart-section-title">
        <h2
          id="cart-section-title"
          className="mb-6 text-2xl font-semibold tracking-tight"
        >
          {t("shoppingCart")}
        </h2>
        <CartPanel />
      </section>

      <section
        aria-labelledby="orders-section-title"
        className="mt-16 border-t border-border pt-12"
      >
        <h2
          id="orders-section-title"
          className="text-2xl font-semibold tracking-tight"
        >
          {tOrders("title")}
        </h2>
        <p className="mt-2 mb-6 text-muted-foreground">{tOrders("subtitle")}</p>

        {orders.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={tOrders("emptyTitle")}
            description={tOrders("emptyBody")}
          />
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
