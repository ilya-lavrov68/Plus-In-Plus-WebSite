import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/accounts";
import {
  findOrderById,
  findPaymentByExternalId,
  listPaymentsForOrder,
  markPaymentSucceeded,
  transitionOrder,
} from "@/lib/commerce-data";
import { withTransaction } from "@/lib/db";
import { verifyPaymentHash } from "@/lib/payments/robokassa";
import { resolveRobokassaConfig } from "@/lib/payments/robokassa-config";

/** Единственный writer успешной оплаты — подписанный Result URL Робокассы. */
export async function handleRobokassaResult(request: Request): Promise<Response> {
  const { config } = await resolveRobokassaConfig();
  if (!config) {
    console.error("[robokassa] Result URL вызван, но провайдер не настроен");
    return new NextResponse("OK0", { status: 200 });
  }

  const form = await request.formData().catch(() => null);
  const fromQuery = new URL(request.url).searchParams;
  const read = (key: string): string => {
    const value = form?.get(key);
    if (typeof value === "string" && value) return value;
    return fromQuery.get(key) ?? "";
  };

  const outSum = read("OutSum").trim();
  const invId = read("InvId").trim();
  const signature = read("SignatureValue").trim();
  const orderId = read("shp_OrderId").trim();

  if (!invId) {
    console.error("[robokassa] Уведомление без InvId");
    return new NextResponse("OK0", { status: 200 });
  }
  if (!orderId) {
    console.error(`[robokassa] Уведомление без Shp_OrderId для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  const valid = verifyPaymentHash(config, {
    outSum,
    invId,
    signatureValue: signature,
    extra: { shp_OrderId: orderId },
  });
  if (!valid) {
    console.error(`[robokassa] Подпись не совпала для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  const amountKopecks = Math.round(Number(outSum.replace(",", ".")) * 100);
  if (!Number.isFinite(amountKopecks) || amountKopecks <= 0) {
    console.error(`[robokassa] Некорректная сумма для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  try {
    const payment = await findPaymentByExternalId(invId, "robokassa");
    if (!payment) {
      console.error(`[robokassa] Счёт ${invId} не найден`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    const paymentOrderId = payment.orderId;
    if (paymentOrderId !== orderId) {
      console.error(`[robokassa] Заказ не совпал для счёта ${invId}`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }
    if (payment.amount !== amountKopecks) {
      console.error(`[robokassa] Сумма не совпала для счёта ${invId}`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }
    if (payment.status === "succeeded") {
      return new NextResponse(`OK${invId}`, { status: 200 });
    }
    if (payment.status !== "pending") {
      console.error(`[robokassa] Счёт ${invId} больше не ожидает оплаты`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    const now = new Date();
    await withTransaction(async (tx) => {
      const invoices = await listPaymentsForOrder(paymentOrderId, tx);
      const latestInvoice = invoices[0];
      const order = await findOrderById(paymentOrderId, tx);

      if (
        latestInvoice?.id !== payment.id ||
        latestInvoice.status !== "pending" ||
        !order ||
        order.status !== "awaiting_payment" ||
        order.total !== payment.amount
      ) {
        console.error(`[robokassa] Счёт ${invId} устарел или заказ уже закрыт для оплаты`);
        return;
      }

      const payloadJson = JSON.stringify({ outSum, invId, orderId, receivedAt: now.toISOString() });
      if (!(await markPaymentSucceeded(payment.id, payloadJson, tx))) return;

      // Условный переход: заказ оплачивается только из ожидающего статуса.
      const paid = await transitionOrder(order.id, "awaiting_payment", { status: "paid", paidAt: now }, tx);
      if (!paid) throw new Error("Order changed while confirming payment");

      await recordActivity({
        action: "paid",
        entityType: "order",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — оплачен, ${(amountKopecks / 100).toLocaleString("ru-RU")} ₽`,
        actorId: null,
      }, tx);
    });

    return new NextResponse(`OK${invId}`, { status: 200 });
  } catch (error) {
    console.error("[robokassa] Не удалось обработать уведомление:", error);
    return new NextResponse("error", { status: 200 });
  }
}

export async function robokassaResultHealth(): Promise<Response> {
  const { config, source } = await resolveRobokassaConfig();
  return NextResponse.json({
    ok: true,
    provider: "robokassa",
    configured: config !== null,
    source,
  });
}
