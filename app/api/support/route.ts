import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { recordActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: "Database connection is temporarily unavailable." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
  const lastName =
    typeof body.lastName === "string" ? body.lastName.trim().slice(0, 80) : "";
  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase().slice(0, 160)
      : "";
  const subject =
    typeof body.subject === "string"
      ? body.subject.trim().slice(0, 160)
      : "Project inquiry";
  const serviceSlug =
    typeof body.serviceSlug === "string"
      ? body.serviceSlug.trim().slice(0, 120)
      : "";
  const serviceId =
    typeof body.serviceId === "string" ? body.serviceId.trim().slice(0, 120) : "";
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  if (!firstName || !lastName) {
    return NextResponse.json(
      { ok: false, error: "Please enter both your first name and last name." },
      { status: 400 }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (message.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Please describe your project idea or request." },
      { status: 400 }
    );
  }

  try {
    const session = await auth().catch(() => null);
    let customerId: string | null = session?.user?.id ?? null;

    if (customerId) {
      const existingById = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!existingById) {
        customerId = null;
      } else if (!existingById.firstName || !existingById.lastName) {
        await prisma.user.update({
          where: { id: existingById.id },
          data: {
            firstName: existingById.firstName || firstName,
            lastName: existingById.lastName || lastName,
          },
        });
      }
    }

    if (!customerId) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true, firstName: true, lastName: true },
      });

      if (existingByEmail) {
        customerId = existingByEmail.id;
        if (!existingByEmail.firstName || !existingByEmail.lastName) {
          await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              firstName: existingByEmail.firstName || firstName,
              lastName: existingByEmail.lastName || lastName,
            },
          });
        }
      } else {
        const randomPasswordHash = await bcrypt.hash(
          crypto.randomBytes(24).toString("hex"),
          10
        );
        const createdCustomer = await prisma.user.create({
          data: {
            email,
            passwordHash: randomPasswordHash,
            firstName,
            lastName,
            role: "USER",
          },
          select: { id: true },
        });
        customerId = createdCustomer.id;
      }
    }

    const matchedService = await prisma.service.findFirst({
      where: serviceId
        ? { OR: [{ id: serviceId }, { slug: serviceSlug || serviceId }] }
        : serviceSlug
          ? { slug: serviceSlug }
          : { title: subject },
      select: {
        id: true,
        title: true,
        basePrice: true,
        currency: true,
      },
    });

    const itemTitle = matchedService?.title || subject || "Design inquiry";
    const estimatedAmount = matchedService?.basePrice ?? 0;
    const currency = matchedService?.currency ?? "RUB";
    const formattedCustomerNote = `Contact: ${firstName} ${lastName} <${email}>\nService: ${itemTitle}\n\n${message}`;

    let orderNumber = "";
    const resolvedCustomerId = customerId;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = (await prisma.order.count()) + 1 + attempt;
      orderNumber = formatOrderNumber(sequence);
      try {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              number: orderNumber,
              userId: resolvedCustomerId,
              status: "quote_requested",
              estimatedAmount,
              subtotal: 0,
              discount: 0,
              total: 0,
              currency,
              customerNote: formattedCustomerNote,
              items: {
                create: {
                  serviceId: matchedService?.id ?? null,
                  title: itemTitle,
                  quantity: 1,
                  estimatedUnitPrice: estimatedAmount,
                  unitPrice: 0,
                  totalPrice: 0,
                  optionsSnapshot: JSON.stringify([
                    {
                      group: "Source",
                      option: "Contact Us form",
                      priceDelta: 0,
                      priceFactor: 1,
                    },
                  ]),
                },
              },
            },
          });

          await recordActivity(tx, {
            action: "create",
            entityType: "order",
            entityId: order.id,
            title: `${orderNumber} — ${itemTitle}`,
            actorId: resolvedCustomerId,
          });
        });
        break;
      } catch (err) {
        if (attempt === 4) throw err;
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/manager/orders");
    revalidatePath("/orders");

    return NextResponse.json({ ok: true, orderNumber });
  } catch (error) {
    console.error("Failed to save Contact Us inquiry:", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your inquiry. Please try again." },
      { status: 500 }
    );
  }
}
