import { prisma } from "@/lib/prisma";
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

/**
 * Выставить счёт по согласованной цене.
 *
 * Если у заказа уже есть ожидающий счёт на эту же сумму — возвращаем его, а
 * не плодим новые: клиент мог просто открыть ссылку во второй раз. Если цену
 * изменили, старый счёт закрывается и выставляется новый, чтобы у клиента не
 * было двух ссылок на разные суммы.
 */
export async function issueInvoice(input: IssueInvoiceInput): Promise<IssuedInvoice | null> {
  if (!prisma) return null;

  // Ключи: сначала настройки в БД (вкладка Settings), потом env, потом
  // демо-магазин. Одна и та же конфигурация используется и для подписи
  // ссылки здесь, и для проверки уведомления в Result URL.
  const { config } = await resolveRobokassaConfig();

  const existing = await prisma.payment.findMany({
    where: { orderId: input.orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amount: true, externalId: true, paymentUrl: true },
  });

  const reusable = existing.find((payment) => payment.status === "pending" && payment.amount === input.amount);
  if (reusable) {
    // Ссылки могло и не быть — например, провайдер подключили позже.
    if (reusable.paymentUrl || !config) {
      return {
        paymentId: reusable.id,
        paymentUrl: reusable.paymentUrl,
        invId: reusable.externalId ? Number(reusable.externalId) || null : null,
      };
    }
  }

  // Старые ожидающие счета больше недействительны: сумма изменилась.
  if (existing.some((payment) => payment.status === "pending" && payment.amount !== input.amount)) {
    await prisma.payment.updateMany({
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

  const payment = await prisma.payment.create({
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
