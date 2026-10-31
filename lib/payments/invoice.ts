import type { PayloadTransactionClient } from "@/lib/payload-db";

import { db as database } from "@/lib/payload-db";
import { buildPaymentUrl } from "@/lib/payments/robokassa";
import { resolveRobokassaConfig } from "@/lib/payments/robokassa-config";

export interface IssueInvoiceInput {
  orderId: string;
  orderNumber: string;
  /** Копейки — согласованная менеджером цена. */
  amount: number;
  currency: string;
  customerEmail: string | null;
}

export interface IssuedInvoice {
  paymentId: string;
  /** Ссылка на форму оплаты, если провайдер подключён. */
  paymentUrl: string | null;
  invId: number | null;
}

type InvoiceDb = Pick<PayloadTransactionClient, "payment" | "siteSetting">;

/**
 * Номер счёта для Робокассы.
 *
 * Провайдер требует целое число, а номера заказов у нас текстовые
 * (ПИП-000007). Выводим из номера: 7 → 7000 + попытка. Так счёт остаётся
 * узнаваемым — менеджер видит связь с заказом — а повторные выставления не
 * сталкиваются: каждая следующая попытка даёт следующий номер.
 */
export function invoiceNumber(orderNumber: string, attempt: number): number {
  const digits = orderNumber.replace(/\D/g, "");
  const base = Number(digits) || 0;
  return base * 1000 + (Math.max(0, attempt) % 1000);
}

function isUniqueConflict(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "PAYLOAD_UNIQUE_CONSTRAINT";
}

/**
 * Все чтения и записи счёта выполняются через переданный клиент. В частности,
 * setOrderPrice передаёт сюда свою транзакцию, поэтому цена, позиции заказа и
 * платёж либо сохраняются вместе, либо вместе откатываются.
 */
async function issueInvoiceWithDb(
  input: IssueInvoiceInput,
  db: InvoiceDb,
): Promise<IssuedInvoice | null> {
  // Ключи: сначала настройки в БД (вкладка Settings), потом env, потом
  // демо-магазин. Одна и та же конфигурация используется и для подписи
  // ссылки здесь, и для проверки уведомления в Result URL.
  const { config } = await resolveRobokassaConfig(db);

  const existing = await db.payment.findMany({
    where: { orderId: input.orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amount: true, externalId: true, paymentUrl: true },
  });

  // Фактическая оплата важнее возможно устаревшего статуса заказа: после неё
  // нельзя выпустить ещё один счёт через прямой вызов этого модуля.
  if (existing.some((payment) => payment.status === "succeeded")) return null;

  // Актуален только последний счёт. Старый pending с такой же суммой нельзя
  // воскрешать, если после него уже была создана новая попытка оплаты.
  const latest = existing[0];
  const reusable = latest?.status === "pending" && latest.amount === input.amount
    ? latest
    : null;
  if (reusable?.paymentUrl) {
    return {
      paymentId: reusable.id,
      paymentUrl: reusable.paymentUrl,
      invId: reusable.externalId ? Number(reusable.externalId) || null : null,
    };
  }

  if (reusable && !config) {
    return {
      paymentId: reusable.id,
      paymentUrl: null,
      invId: reusable.externalId ? Number(reusable.externalId) || null : null,
    };
  }

  // Если счёт был выставлен до подключения провайдера, не меняем его InvId:
  // подписываем ссылку для того же pending-платежа. Это идемпотентно и не
  // создаёт лишнюю историю при каждом нажатии «Оплатить».
  const reusableInvId = reusable?.externalId ? Number(reusable.externalId) : NaN;
  if (reusable && config && Number.isSafeInteger(reusableInvId) && reusableInvId >= 0) {
    const paymentUrl = buildPaymentUrl(
      {
        amount: input.amount,
        invId: reusableInvId,
        description: `Оплата заказа ${input.orderNumber}`,
        email: input.customerEmail,
        extra: { OrderId: input.orderId },
      },
      config,
    );
    const updated = await db.payment.updateMany({
      where: {
        id: reusable.id,
        orderId: input.orderId,
        status: "pending",
        amount: input.amount,
        paymentUrl: null,
      },
      data: { paymentUrl },
    });
    if (updated.count === 1) {
      return { paymentId: reusable.id, paymentUrl, invId: reusableInvId };
    }

    // Другой запрос мог подписать тот же счёт первым. Возвращаем его ссылку,
    // но никогда не воскрешаем уже оплаченный или закрытый платёж.
    const current = await db.payment.findFirst({
      where: { id: reusable.id, orderId: input.orderId },
      select: { id: true, status: true, amount: true, externalId: true, paymentUrl: true },
    });
    if (current?.status === "succeeded") return null;
    if (current?.status === "pending" && current.amount === input.amount && current.paymentUrl) {
      return {
        paymentId: current.id,
        paymentUrl: current.paymentUrl,
        invId: current.externalId ? Number(current.externalId) || null : null,
      };
    }
  }

  // Перед созданием нового счёта закрываем все прежние pending. Сюда попадают
  // изменение цены и старая запись без пригодного InvId.
  if (existing.some((payment) => payment.status === "pending")) {
    await db.payment.updateMany({
      where: { orderId: input.orderId, status: "pending" },
      data: { status: "failed" },
    });
  }

  const invId = invoiceNumber(input.orderNumber, existing.length);
  const paymentUrl = buildPaymentUrl(
    {
      amount: input.amount,
      invId,
      description: `Оплата заказа ${input.orderNumber}`,
      email: input.customerEmail,
      extra: { OrderId: input.orderId },
    },
    config,
  );

  const payment = await db.payment.create({
    data: {
      orderId: input.orderId,
      provider: "robokassa",
      externalId: String(invId),
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      // Без настроенного провайдера ссылки нет, но счёт в базе остаётся:
      // провайдера подключат позже, и история не потеряется.
      paymentUrl,
    },
    select: { id: true, paymentUrl: true },
  });

  return { paymentId: payment.id, paymentUrl: payment.paymentUrl, invId };
}

/**
 * Выставить счёт по согласованной цене.
 *
 * Если у заказа уже есть ожидающий счёт на эту же сумму — возвращаем его, а
 * не плодим новые. Без переданной транзакции создаём собственную; уникальность
 * (provider, externalId) защищает InvId при гонке, а повтор после конфликта
 * возвращает уже созданный параллельным запросом счёт.
 */
export async function issueInvoice(
  input: IssueInvoiceInput,
  db?: InvoiceDb,
): Promise<IssuedInvoice | null> {
  if (db) return issueInvoiceWithDb(input, db);
  if (!database) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.transaction((tx) => issueInvoiceWithDb(input, tx));
    } catch (error) {
      if (!isUniqueConflict(error) || attempt === 1) throw error;
    }
  }
  return null;
}
