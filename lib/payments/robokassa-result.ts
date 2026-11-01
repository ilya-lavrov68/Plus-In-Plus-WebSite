import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/activity-log";
import { getPayloadClient, payloadId, withPayloadTransaction } from "@/lib/payload-native";
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
    const payload = await getPayloadClient();
    const paymentResult = await payload.find({
      collection: "payments",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { and: [{ externalId: { equals: invId } }, { provider: { equals: "robokassa" } }] },
    });
    const payment = paymentResult.docs[0];
    if (!payment) {
      console.error(`[robokassa] Счёт ${invId} не найден`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    const paymentOrderId = payloadId(payment.orderId);
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
    await withPayloadTransaction(payload, async (req) => {
      const latestResult = await payload.find({
        collection: "payments",
        depth: 0,
        limit: 1,
        sort: "-createdAt",
        overrideAccess: true,
        req,
        where: { and: [{ orderId: { equals: paymentOrderId } }, { provider: { equals: "robokassa" } }] },
      });
      const orderResult = await payload.find({
        collection: "orders",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
        where: { id: { equals: paymentOrderId } },
      });
      const latestInvoice = latestResult.docs[0];
      const order = orderResult.docs[0];

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

      const claimed = await payload.update({
        collection: "payments",
        data: {
          status: "succeeded",
          paidAt: now.toISOString(),
          rawPayload: JSON.stringify({ outSum, invId, orderId, receivedAt: now.toISOString() }),
        },
        overrideAccess: true,
        req,
        where: { and: [{ id: { equals: payment.id } }, { status: { equals: "pending" } }] },
      });
      if (claimed.docs.length !== 1) return;

      const updatedOrder = await payload.update({
        collection: "orders",
        data: { status: "paid", paidAt: now.toISOString() },
        overrideAccess: true,
        req,
        where: {
          and: [
            { id: { equals: order.id } },
            { status: { equals: "awaiting_payment" } },
            { total: { equals: payment.amount } },
          ],
        },
      });
      if (updatedOrder.docs.length !== 1) {
        throw new Error("Order changed while confirming payment");
      }

      await recordActivity(payload, req, {
        action: "paid",
        entityType: "order",
        entityId: order.id,
        title: `${order.orderNumber ?? order.number ?? order.id} — оплачен, ${(amountKopecks / 100).toLocaleString("ru-RU")} ₽`,
        actorId: null,
      });
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
