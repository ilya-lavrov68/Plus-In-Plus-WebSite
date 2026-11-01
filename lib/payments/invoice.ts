import type { Payload, PayloadRequest } from "payload";

import { getPayloadClient, isPayloadUniqueError, withPayloadTransaction } from "@/lib/payload-native";
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

async function issueInvoiceWithPayload(
  input: IssueInvoiceInput,
  payload: Payload,
  req: PayloadRequest,
): Promise<IssuedInvoice | null> {
  const { config } = await resolveRobokassaConfig(payload, req);
  const result = await payload.find({
    collection: "payments",
    depth: 0,
    pagination: false,
    sort: "-createdAt",
    overrideAccess: true,
    req,
    where: { orderId: { equals: input.orderId } },
  });
  const existing = result.docs;

  if (existing.some((payment) => payment.status === "succeeded")) return null;

  const latest = existing[0];
  const reusable = latest?.status === "pending" && latest.amount === input.amount ? latest : null;
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

  const reusableInvId = reusable?.externalId ? Number(reusable.externalId) : NaN;
  if (reusable && config && Number.isSafeInteger(reusableInvId) && reusableInvId >= 0) {
    const paymentUrl = buildPaymentUrl({
      amount: input.amount,
      invId: reusableInvId,
      description: `Оплата заказа ${input.orderNumber}`,
      email: input.customerEmail,
      extra: { OrderId: input.orderId },
    }, config);
    const updated = await payload.update({
      collection: "payments",
      data: { paymentUrl },
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { equals: reusable.id } },
          { orderId: { equals: input.orderId } },
          { status: { equals: "pending" } },
          { amount: { equals: input.amount } },
          { paymentUrl: { exists: false } },
        ],
      },
    });
    if (updated.docs.length === 1) {
      return { paymentId: reusable.id, paymentUrl, invId: reusableInvId };
    }

    const currentResult = await payload.find({
      collection: "payments",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: { and: [{ id: { equals: reusable.id } }, { orderId: { equals: input.orderId } }] },
    });
    const current = currentResult.docs[0];
    if (current?.status === "succeeded") return null;
    if (current?.status === "pending" && current.amount === input.amount && current.paymentUrl) {
      return {
        paymentId: current.id,
        paymentUrl: current.paymentUrl,
        invId: current.externalId ? Number(current.externalId) || null : null,
      };
    }
  }

  if (existing.some((payment) => payment.status === "pending")) {
    await payload.update({
      collection: "payments",
      data: { status: "failed" },
      overrideAccess: true,
      req,
      where: { and: [{ orderId: { equals: input.orderId } }, { status: { equals: "pending" } }] },
    });
  }

  const invId = invoiceNumber(input.orderNumber, existing.length);
  const paymentUrl = buildPaymentUrl({
    amount: input.amount,
    invId,
    description: `Оплата заказа ${input.orderNumber}`,
    email: input.customerEmail,
    extra: { OrderId: input.orderId },
  }, config);
  const payment = await payload.create({
    collection: "payments",
    data: {
      orderId: input.orderId,
      provider: "robokassa",
      externalId: String(invId),
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      paymentUrl,
    },
    depth: 0,
    overrideAccess: true,
    req,
  });
  return { paymentId: payment.id, paymentUrl: payment.paymentUrl ?? null, invId };
}

/** Выставляет счёт атомарно; повторный запрос возвращает существующий актуальный счёт. */
export async function issueInvoice(
  input: IssueInvoiceInput,
  payloadInstance?: Payload,
  existingReq?: PayloadRequest,
): Promise<IssuedInvoice | null> {
  const payload = payloadInstance ?? await getPayloadClient();
  if (existingReq) return issueInvoiceWithPayload(input, payload, existingReq);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await withPayloadTransaction(payload, (req) => issueInvoiceWithPayload(input, payload, req));
    } catch (error) {
      if (!isPayloadUniqueError(error) || attempt === 1) throw error;
    }
  }
  return null;
}
