import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/site/empty-state";
import { OrderCard } from "@/components/site/order-card";
import { Button } from "@/components/ui/button";
import { getCustomerOrders } from "@/lib/customer-orders";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("orders");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OrdersPage() {
  const [session, t] = await Promise.all([
    auth(),
    getRequestTranslations("orders"),
  ]);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const orders = await getCustomerOrders();

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/contact" className="gap-2">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t("createOrder")}
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title={t("emptyTitle")}
            description={t("emptyBody")}
          />
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href="/contact">{t("createFirstOrder")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
