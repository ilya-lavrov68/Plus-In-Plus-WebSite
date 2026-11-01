import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getPayloadClient, payloadId } from "@/lib/payload-native";
import { issueInvoice } from "@/lib/payments/invoice";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
import { roleLevel } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Создаёт/переиспользует счёт только для собственного или staff-доступного заказа. */
async function createPaymentRedirect(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    return NextResponse.json({ ok: false, error: "unsupported_media_type" }, { status: 415 });
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

  const form = await request.formData().catch(() => null);
  const value = form?.get("orderId");
  const orderId = typeof value === "string" ? value.trim() : "";
  if (!orderId || orderId.length > 128) {
    return NextResponse.json({ ok: false, error: "order_id_required" }, { status: 400 });
  }

  const payload = await getPayloadClient();
  const [accountResult, orderResult] = await Promise.all([
    payload.find({
      collection: "accounts",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { id: { equals: session.user.id } },
    }),
    payload.find({
      collection: "orders",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { status: { not_equals: "cart" } },
          { or: [{ id: { equals: orderId } }, { number: { equals: orderId } }, { orderNumber: { equals: orderId } }] },
        ],
      },
    }),
  ]);
  const account = accountResult.docs[0];
  const order = orderResult.docs[0];
  if (!account || account.isBlocked) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }

  const customerId = payloadId(order.userId);
  const isOwner = customerId === account.id;
  const isStaff = roleLevel(account.role) >= 1 && roleLevel(session.user.role) >= 1;
  if (!isOwner && !isStaff) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const succeeded = await payload.count({
    collection: "payments",
    overrideAccess: true,
    where: { and: [{ orderId: { equals: order.id } }, { status: { equals: "succeeded" } }] },
  });
  if (succeeded.totalDocs > 0) {
    return NextResponse.redirect(new URL("/payment/success", request.url), 303);
  }
  if (order.total <= 0 || order.status !== "awaiting_payment") {
    return NextResponse.json({ ok: false, error: "price_not_agreed" }, { status: 409 });
  }

  let customerEmail = isOwner ? account.email : null;
  if (!isOwner && customerId) {
    const customerResult = await payload.find({
      collection: "accounts",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: { email: true },
      where: { id: { equals: customerId } },
    });
    customerEmail = customerResult.docs[0]?.email ?? null;
  }

  const invoice = await issueInvoice({
    orderId: order.id,
    orderNumber: order.orderNumber ?? order.number ?? order.id,
    amount: order.total,
    currency: order.currency,
    customerEmail,
  }, payload);
  if (!invoice?.paymentUrl) {
    return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 503 });
  }
  return NextResponse.redirect(invoice.paymentUrl, 303);
}

export async function POST(request: Request): Promise<Response> {
  return createPaymentRedirect(request);
}
