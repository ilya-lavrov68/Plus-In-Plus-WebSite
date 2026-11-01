import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { recordActivity } from "@/lib/activity-log";
import { requireActiveCustomer } from "@/lib/cart";
import { getPayloadClient, isPayloadUniqueError, withPayloadTransaction } from "@/lib/payload-native";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, retryAfterHeaders } from "@/lib/rate-limit";
import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-origin";

const WINDOW_MS = 10 * 60 * 1000;
const ADDRESS_LIMIT = 5;
const EMAIL_LIMIT = 3;
const MAX_BODY_BYTES = 32 * 1024;

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json(
      { ok: false, error: "Please log in to send an account-linked inquiry." },
      { status: 401 },
    );
  }

  const address = getClientAddress(
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"),
  );
  const addressLimit = await checkRateLimitAsync(
    hashRateLimitIdentifier(`support-address:${address}`), ADDRESS_LIMIT, WINDOW_MS,
  );
  if (!addressLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429, headers: retryAfterHeaders(addressLimit.retryAfterSeconds) },
    );
  }

  const bodyResult = await readJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { ok: false, error: bodyResult.error },
      { status: bodyResult.status },
    );
  }
  if (!isJsonObject(bodyResult.value)) {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }
  const body = bodyResult.value;

  const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 80) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 160) : "Project inquiry";
  const serviceSlug = typeof body.serviceSlug === "string" ? body.serviceSlug.trim().slice(0, 120) : "";
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim().slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  if (!firstName || !lastName) {
    return NextResponse.json(
      { ok: false, error: "Please enter both your first name and last name." },
      { status: 400 },
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const emailLimit = await checkRateLimitAsync(
    hashRateLimitIdentifier(`support-email:${email}`), EMAIL_LIMIT, WINDOW_MS,
  );
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests for this email. Please wait a few minutes." },
      { status: 429, headers: retryAfterHeaders(emailLimit.retryAfterSeconds) },
    );
  }
  if (message.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Please describe your project idea or request." },
      { status: 400 },
    );
  }

  try {
    const payload = await getPayloadClient();
    const serviceSelector: Where = serviceId
      ? { or: [{ id: { equals: serviceId } }, { slug: { equals: serviceSlug || serviceId } }] }
      : serviceSlug
        ? { slug: { equals: serviceSlug } }
        : { title: { equals: subject } };
    const serviceResult = await payload.find({
      collection: "services",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          serviceSelector,
          { isActive: { equals: true } },
          { isPublished: { equals: true } },
        ],
      },
    });
    const matchedService = serviceResult.docs[0] ?? null;
    const itemTitle = matchedService?.title || subject || "Design inquiry";
    const estimatedAmount = matchedService?.basePrice ?? 0;
    const currency = matchedService?.currency ?? "RUB";
    const formattedCustomerNote = `Contact: ${firstName} ${lastName} <${email}>\nService: ${itemTitle}\n\n${message}`;

    let orderNumber = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = (await payload.count({ collection: "orders", overrideAccess: true })).totalDocs + 1 + attempt;
      orderNumber = formatOrderNumber(sequence);
      try {
        await withPayloadTransaction(payload, async (req) => {
          const order = await payload.create({
            collection: "orders",
            data: {
              orderNumber,
              number: orderNumber,
              userId: customer.id,
              status: "quote_requested",
              estimatedAmount,
              subtotal: 0,
              discount: 0,
              total: 0,
              currency,
              customerNote: formattedCustomerNote,
            },
            depth: 0,
            overrideAccess: true,
            req,
          });
          await payload.create({
            collection: "order-items",
            data: {
              orderId: order.id,
              serviceId: matchedService?.id ?? null,
              itemType: "service",
              itemId: matchedService?.id ?? "",
              title: itemTitle,
              quantity: 1,
              estimatedUnitPrice: estimatedAmount,
              unitPrice: 0,
              totalPrice: 0,
              optionsSnapshot: JSON.stringify([{
                group: "Source",
                option: "Contact Us form",
                priceDelta: 0,
                priceFactor: 1,
              }]),
            },
            overrideAccess: true,
            req,
          });
          if (matchedService) {
            await payload.create({
              collection: "order-services",
              data: { orderId: order.id, serviceId: matchedService.id, quantity: 1 },
              overrideAccess: true,
              req,
            });
          }
          await recordActivity(payload, req, {
            action: "create",
            entityType: "order",
            entityId: order.id,
            title: `${orderNumber} — ${itemTitle}`,
            actorId: customer.id,
          });
        });
        break;
      } catch (error) {
        if (!isPayloadUniqueError(error) || attempt === 4) throw error;
      }
    }

    revalidatePath("/admin/collections/orders");
    revalidatePath("/admin");
    revalidatePath("/orders");
    revalidatePath("/cart");
    return NextResponse.json({ ok: true, orderNumber });
  } catch (error) {
    console.error("Failed to save Contact Us inquiry:", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your inquiry. Please try again." },
      { status: 500 },
    );
  }
}
