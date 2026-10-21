import Link from "next/link";
import { CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { signatureMatches, successSignature } from "@/lib/payments/robokassa";
import { resolveRobokassaConfig } from "@/lib/payments/robokassa-config";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

interface PaymentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Страница успеха. Деньги зачисляет серверное уведомление, а не эта
 * страница: закрыть вкладку можно в любой момент. Здесь только показываем
 * человеку, что всё прошло, и проверяем подпись — чтобы по чужой ссылке не
 * отрисовалось «оплачено».
 */
export default async function PaymentSuccessPage({ searchParams }: PaymentPageProps) {
  const query = await searchParams;
  const t = await getRequestTranslations("payment");

  const outSum = first(query.OutSum);
  const invId = first(query.InvId);
  const signature = first(query.SignatureValue);
  const orderId = first(query.shp_OrderId);

  // Ключи могут лежать в настройках БД или быть демо — проверять подпись
  // надо той же конфигурацией, которой ссылка подписывалась.
  const { config } = await resolveRobokassaConfig();
  const signed =
    config !== null &&
    signatureMatches(
      successSignature(config, outSum, invId, orderId ? { shp_OrderId: orderId } : {}),
      signature,
    );

  // Статус показываем из базы, а не из ссылки: вдруг уведомление ещё в пути.
  let status: string | null = null;
  if (prisma && invId) {
    const payment = await prisma.payment
      .findFirst({
        where: { externalId: invId, provider: "robokassa" },
        select: { status: true },
      })
      .catch(() => null);
    status = payment?.status ?? null;
  }

  const paid = status === "succeeded";
  const waiting = status === "pending";

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <CheckCircle aria-hidden="true" className="h-12 w-12 text-emerald-600" />
          <h1 className="text-2xl font-bold tracking-tight">
            {paid ? t("successTitle") : waiting ? t("waitingTitle") : t("pendingTitle")}
          </h1>
          <p className="text-muted-foreground">
            {paid ? t("successBody") : waiting ? t("waitingBody") : t("pendingBody")}
          </p>
          {invId ? <p className="text-sm text-muted-foreground">{t("invoiceNumber")}: {invId}</p> : null}
          {!signed && config ? (
            <p className="text-sm text-muted-foreground">{t("linkNotSigned")}</p>
          ) : null}
          <Button asChild className="mt-2">
            <Link href="/orders">{t("backToOrders")}</Link>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
