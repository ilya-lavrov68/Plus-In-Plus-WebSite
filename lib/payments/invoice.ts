import { isUniqueConstraintError } from "@/lib/accounts";
import {
  expirePendingPayments,
  insertPayment,
  listPaymentsForOrder,
  type PaymentRecord,
} from "@/lib/commerce-data";
import { withTransaction } from "@/lib/db";
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
  paymentUrl: string | null;
  invId: number | null;
}

/** Целый InvId остаётся связанным с номером заказа и номером попытки. */
export function invoiceNumber(orderNumber: string, attempt: number): number {
  const digits = orderNumber.replace(/\D/g, "");
  const base = Number(digits) || 0;
  return base * 1000 + (Math.max(0, attempt) % 1000);
}

function invoiceFromPayment(payment: PaymentRecord): IssuedInvoice {
  return {
    paymentId: payment.id,
    paymentUrl: payment.paymentUrl,
    invId: payment.externalId ? Number(payment.externalId) || null : null,
  };
}

/**
 * Выставляет счёт в одной транзакции. Повторный запрос с той же суммой
 * возвращает уже существующий актуальный счёт, а не плодит новые InvId.
 */
async function issueInvoiceInTransaction(input: IssueInvoiceInput): Promise<IssuedInvoice | null> {
  const { config } = await resolveRobokassaConfig();
  return withTransaction(async (tx) => {
    const existing = await listPaymentsForOrder(input.orderId, tx);
    if (existing.some((payment) => payment.status === "succeeded")) return null;

    const latest = existing[0];
    const reusable = latest?.status === "pending" && latest.amount === input.amount ? latest : null;
    if (reusable?.paymentUrl) return invoiceFromPayment(reusable);

    const reusableInvId = reusable?.externalId ? Number(reusable.externalId) : NaN;
    if (reusable && config && Number.isSafeInteger(reusableInvId) && reusableInvId >= 0) {
      const paymentUrl = buildPaymentUrl({
        amount: input.amount,
        invId: reusableInvId,
        description: `Оплата заказа ${input.orderNumber}`,
        email: input.customerEmail,
        extra: { OrderId: input.orderId },
      }, config);
      // Условный UPDATE: ссылку получает только всё ещё ожидающий счёт.
      const updated = await tx.run(
        `update payments set payment_url = ?, updated_at = ? where id = ? and status = 'pending' and payment_url is null`,
        [paymentUrl, new Date().toISOString(), reusable.id],
      );
      if (updated === 1) return { paymentId: reusable.id, paymentUrl, invId: reusableInvId };
      const [current] = await listPaymentsForOrder(input.orderId, tx);
      if (current?.status === "succeeded") return null;
      if (current?.status === "pending" && current.amount === input.amount && current.paymentUrl) {
        return invoiceFromPayment(current);
      }
    }
    if (reusable && !config) return invoiceFromPayment(reusable);

    if (existing.some((payment) => payment.status === "pending")) {
      await expirePendingPayments(input.orderId, tx);
    }

    const invId = invoiceNumber(input.orderNumber, existing.length);
    const paymentUrl = buildPaymentUrl({
      amount: input.amount,
      invId,
      description: `Оплата заказа ${input.orderNumber}`,
      email: input.customerEmail,
      extra: { OrderId: input.orderId },
    }, config);
    const payment = await insertPayment({
      orderId: input.orderId,
      provider: "robokassa",
      externalId: String(invId),
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      paymentUrl,
    }, tx);
    return { paymentId: payment.id, paymentUrl: payment.paymentUrl ?? null, invId };
  });
}

/** Публичная обёртка: гонку двух параллельных выставлений ловит уникальный ключ провайдера. */
export async function issueInvoice(input: IssueInvoiceInput): Promise<IssuedInvoice | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await issueInvoiceInTransaction(input);
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 1) throw error;
    }
  }
  return null;
}
