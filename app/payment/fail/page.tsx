import Link from "next/link";
import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

interface PaymentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Страница отказа. Подпись здесь не проверяем: смысла нет, страница не даёт
 * никаких прав, а человеку важно понять, что случилось, и попробовать снова.
 */
export default async function PaymentFailPage({ searchParams }: PaymentPageProps) {
  const query = await searchParams;
  const [t, locale] = await Promise.all([
    getRequestTranslations("payment"),
    getRequestLocale(),
  ]);

  const invId = first(query.InvId);
  const outSum = first(query.OutSum);

  // Если уведомление об оплате успело прийти раньше браузера — человек
  // просто закрыл вкладку не там, где мы ждали. Показываем правду.
  let alreadyPaid = false;
  if (prisma && invId) {
    const payment = await prisma.payment
      .findFirst({
        where: { externalId: invId, provider: "robokassa" },
        select: { status: true },
      })
      .catch(() => null);
    alreadyPaid = payment?.status === "succeeded";
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <XCircle aria-hidden="true" className="h-12 w-12 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight">
            {alreadyPaid ? t("alreadyPaidTitle") : t("failTitle")}
          </h1>
          <p className="text-muted-foreground">
            {alreadyPaid ? t("alreadyPaidBody") : t("failBody")}
          </p>
          {invId ? <p className="text-sm text-muted-foreground">{t("invoiceNumber")}: {invId}</p> : null}
          {outSum ? (
            <p className="text-sm text-muted-foreground">
              {t("amount")}: {Number(outSum.replace(",", ".")).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB")} ₽
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/orders">{t("backToOrders")}</Link>
            </Button>
            <Button asChild>
              <Link href="/">{t("backHome")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
