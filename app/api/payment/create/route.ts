import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { issueInvoice } from "@/lib/payments/invoice";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
import { roleLevel } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * «Оплатить»: генерирует ссылку Робокассы по уже согласованной цене и
 * редиректит пользователя на форму оплаты.
 *
 * Цену здесь не назначают — её фиксирует менеджер (см. setOrderPrice).
 * Маршрут только достаёт/создаёт счёт на сумму заказа. Доступ: владелец
 * заказа или любой сотрудник; чужой заказ по подставленному orderId
 * оплатить нельзя.
 */
async function createPaymentRedirect(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    return NextResponse.json({ ok: false, error: "unsupported_media_type" }, { status: 415 });
  }
  if (!prisma) {
    return NextResponse.json({ ok: false, error: "payments_unavailable" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const address = getClientAddress(request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"));
  const limit = await checkRateLimitAsync(
    hashRateLimitIdentifier(`payment-create:${address}:${session.user.id}`),
    10,
    10 * 60 * 1000,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }

  let orderId = "";
  const form = await request.formData().catch(() => null);
  const value = form?.get("orderId");
  if (typeof value === "string") orderId = value.trim();
  if (!orderId || orderId.length > 128) {
    return NextResponse.json({ ok: false, error: "order_id_required" }, { status: 400 });
  }

  const [account, order] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, isBlocked: true },
    }),
    prisma.order.findFirst({
      where: {
        status: { not: "cart" },
        OR: [
          { id: orderId },
          { number: orderId },
          { orderNumber: orderId },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        number: true,
        userId: true,
        status: true,
        total: true,
        currency: true,
        payments: { where: { status: "succeeded" }, select: { id: true }, take: 1 },
        user: { select: { email: true } },
      },
    }),
  ]);
  if (!account || account.isBlocked) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }

  // Владелец платит за свой заказ; сотрудник может открыть оплату любого —
  // например, чтобы проверить ссылку перед отправкой клиенту.
  const isOwner = order.userId === account.id;
  const isStaff = roleLevel(account.role) >= 1 && roleLevel(session.user.role) >= 1;
  if (!isOwner && !isStaff) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (order.payments.length > 0) {
    return NextResponse.redirect(new URL("/payment/success", request.url), 303);
  }
  // Пока менеджер не согласовал цену, оплачивать нечего — total равен нулю.
  if (order.total <= 0 || order.status !== "awaiting_payment") {
    return NextResponse.json({ ok: false, error: "price_not_agreed" }, { status: 409 });
  }

  const invoice = await issueInvoice({
    orderId: order.id,
    orderNumber: order.orderNumber ?? order.number ?? order.id,
    amount: order.total,
    currency: order.currency,
    customerEmail: order.user?.email ?? null,
  });
  if (!invoice?.paymentUrl) {
    // Production без ключей Робокассы: счёт в базе есть, ссылки пока нет.
    return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 503 });
  }

  return NextResponse.redirect(invoice.paymentUrl, 303);
}

export async function POST(request: Request): Promise<Response> {
  return createPaymentRedirect(request);
}
