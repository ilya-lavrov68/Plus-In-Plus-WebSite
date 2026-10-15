import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { readConfig, resultSignature, signatureMatches } from "@/lib/payments/robokassa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Result URL — серверное уведомление от Робокассы. Зачисление денег
 * происходит именно здесь, а не на странице успеха: браузер клиента можно
 * закрыть, а вызов Робокассы всё равно дойдёт.
 *
 * Ответ должен быть ровно «OK{InvId}» — иначе Робокасса будет повторять
 * запрос. Поэтому все ошибки пишем в лог, но отвечаем вежливо.
 */
export async function POST(request: Request): Promise<Response> {
  const config = readConfig();
  if (!config || !prisma) {
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

  // Подпись считается по второму паролю — это и есть подтверждение, что
  // вызов пришёл от Робокассы, а не от кого-то, кто узнал адрес.
  const expected = resultSignature(config, outSum, invId, orderId ? { shp_OrderId: orderId } : {});
  if (!signatureMatches(expected, signature)) {
    console.error(`[robokassa] Подпись не совпала для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  const amountKopecks = Math.round(Number(outSum.replace(",", ".")) * 100);
  if (!Number.isFinite(amountKopecks) || amountKopecks <= 0) {
    console.error(`[robokassa] Некорректная сумма «${outSum}» для счёта ${invId}`);
    return new NextResponse(`OK${invId}`, { status: 200 });
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { externalId: invId, provider: "robokassa" },
      select: { id: true, orderId: true, amount: true, status: true },
    });

    if (!payment) {
      console.error(`[robokassa] Счёт ${invId} не найден`);
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

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "succeeded",
          paidAt: now,
          rawPayload: JSON.stringify({ outSum, invId, orderId, receivedAt: now.toISOString() }),
        },
      });
      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: { id: true, number: true, status: true },
      });
      if (!order || order.status === "paid" || order.status === "completed") return;

      await tx.order.update({
        where: { id: payment.orderId },
        // Оплаченный заказ ещё предстоит сделать — это статус paid, а не
        // completed. Завершённым его отметят позже.
        data: { status: "paid", paidAt: now },
      });
      await recordActivity(tx, {
        action: "paid",
        entityType: "order",
        entityId: order.id,
        title: `${order.number} — оплачен, ${(amountKopecks / 100).toLocaleString("ru-RU")} ₽`,
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

/** Робокасса проверяет доступность Result URL запросом GET. */
export function GET(): Response {
  return NextResponse.json({
    ok: true,
    provider: "robokassa",
    configured: readConfig() !== null,
  });
}
