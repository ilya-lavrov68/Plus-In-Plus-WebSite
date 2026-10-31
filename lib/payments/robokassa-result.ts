import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/activity-log";
import { db } from "@/lib/payload-db";
import { verifyPaymentHash } from "@/lib/payments/robokassa";
import { resolveRobokassaConfig } from "@/lib/payments/robokassa-config";

/**
 * Result URL — серверное уведомление от Робокассы. Зачисление денег
 * происходит именно здесь, а не на странице успеха: браузер клиента можно
 * закрыть, а вызов Робокассы всё равно дойдёт.
 *
 * Ответ должен быть ровно «OK{InvId}» — иначе Робокасса будет повторять
 * запрос. Поэтому все ошибки пишем в лог, но отвечаем вежливо.
 *
 * Один обработчик на два адреса: исторический /api/payments/robokassa/result
 * и /api/payment/result из ТЗ. Логика зачисления не должна существовать в
 * двух копиях — деньги такого не прощают.
 */
export async function handleRobokassaResult(request: Request): Promise<Response> {
  const { config } = await resolveRobokassaConfig();
  if (!config || !db) {
    console.error("[robokassa] Result URL вызван, но провайдер не настроен");
    return new NextResponse("OK0", { status: 200 });
  }

  // Робокасса шлёт форму, но в тестовом режиме может прислать и query.
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

  // Подпись считается по второму паролю — это и есть подтверждение, что
  // вызов пришёл от Робокассы, а не от кого-то, кто узнал адрес.
  const valid = verifyPaymentHash(config, {
    outSum,
    invId,
    signatureValue: signature,
    extra: orderId ? { shp_OrderId: orderId } : {},
  });
  if (!valid) {
    console.error(`[robokassa] Подпись не совпала для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  const amountKopecks = Math.round(Number(outSum.replace(",", ".")) * 100);
  if (!Number.isFinite(amountKopecks) || amountKopecks <= 0) {
    console.error(`[robokassa] Некорректная сумма «${outSum}» для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  try {
    const payment = await db.payment.findFirst({
      where: { externalId: invId, provider: "robokassa" },
      select: { id: true, orderId: true, amount: true, status: true },
    });

    if (!payment) {
      console.error(`[robokassa] Счёт ${invId} не найден`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    // Подписанный Shp_OrderId связывает счёт именно с этим заказом. Без этой
    // проверки валидное уведомление можно было бы применить к другой записи.
    if (payment.orderId !== orderId) {
      console.error(`[robokassa] Заказ не совпал для счёта ${invId}`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    // Сумму проверяем обязательно: иначе, подделав OutSum, можно оплатить
    // заказ за копейку.
    if (payment.amount !== amountKopecks) {
      console.error(
        `[robokassa] Сумма не совпала для счёта ${invId}: в уведомлении ${amountKopecks}, у нас ${payment.amount}`,
      );
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    // Робокасса повторяет уведомление, пока не получит OK. Повторный вызов
    // не должен создавать второй заказ или вторую запись в журнале.
    if (payment.status === "succeeded") {
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    if (payment.status !== "pending") {
      console.error(`[robokassa] Счёт ${invId} больше не ожидает оплаты`);
      return new NextResponse(`OK${invId}`, { status: 200 });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      const [latestInvoice, order] = await Promise.all([
        tx.payment.findFirst({
          where: { orderId: payment.orderId, provider: "robokassa" },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        }),
        tx.order.findUnique({
          where: { id: payment.orderId },
          select: { id: true, orderNumber: true, number: true, status: true, total: true },
        }),
      ]);

      // После выставления нового счёта или изменения согласованной цены старое
      // уведомление не должно оплачивать заказ, даже если старая запись ещё pending.
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

      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: {
          status: "succeeded",
          paidAt: now,
          rawPayload: JSON.stringify({ outSum, invId, orderId, receivedAt: now.toISOString() }),
        },
      });
      if (claimed.count !== 1) return;

      const updatedOrder = await tx.order.updateMany({
        where: { id: order.id, status: "awaiting_payment", total: payment.amount },
        // Оплаченный заказ ещё предстоит сделать — это статус paid, а не
        // completed. Завершённым его отметят позже. Блокировка (isLocked)
        // webhook не останавливает: замок — от ручных правок, а не от денег.
        data: { status: "paid", paidAt: now },
      });
      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${order.id} changed while confirming payment ${payment.id}`);
      }

      await recordActivity(tx, {
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
    // Код 200, но без OK — Робокасса повторит запрос позже.
    return new NextResponse("error", { status: 200 });
  }
}

/** Проверка доступности для GET: Робокасса так проверяет Result URL. */
export async function robokassaResultHealth(): Promise<Response> {
  const { config, source } = await resolveRobokassaConfig();
  return NextResponse.json({
    ok: true,
    provider: "robokassa",
    configured: config !== null,
    source,
  });
}
