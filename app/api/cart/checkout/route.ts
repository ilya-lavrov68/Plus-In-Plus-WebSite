import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivity } from "@/lib/activity-log";
import { requireActiveCustomer } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  deadline: z.string().trim().max(64).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout data" }, { status: 400 });
  }

  let parsedDeadline: Date | null = null;
  const rawDeadline = parsed.data.deadline ?? "";
  if (rawDeadline) {
    const candidate = new Date(rawDeadline);
    if (Number.isNaN(candidate.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date" }, { status: 400 });
    }
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const candidateDay = new Date(candidate);
    candidateDay.setUTCHours(0, 0, 0, 0);
    if (candidateDay.getTime() < todayStart.getTime()) {
      return NextResponse.json(
        { error: "Deadline cannot be in the past" },
        { status: 400 }
      );
    }
    parsedDeadline = candidateDay;
  }

  const description =
    typeof parsed.data.description === "string"
      ? parsed.data.description.trim().slice(0, 4000)
      : "";

  try {
    const cart = await prisma.order.findFirst({
      where: { userId: customer.id, status: "cart" },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const serviceIds = Array.from(
      new Set(
        cart.items
          .filter((i) => i.itemType === "service")
          .map((i) => i.itemId || i.serviceId || "")
          .filter(Boolean)
      )
    );
    const productIds = Array.from(
      new Set(
        cart.items
          .filter((i) => i.itemType === "product")
          .map((i) => i.itemId || i.productId || "")
          .filter(Boolean)
      )
    );

    const [services, products] = await Promise.all([
      serviceIds.length > 0
        ? prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
          })
        : Promise.resolve([]),
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
          })
        : Promise.resolve([]),
    ]);

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    let estimatedAmount = 0;
    const itemUpdates: Array<{
      id: string;
      title: string;
      estimatedUnitPrice: number;
      serviceId: string | null;
      productId: string | null;
    }> = [];
    const serviceQuantities = new Map<string, number>();

    for (const item of cart.items) {
      if (item.itemType === "product") {
        const targetId = item.itemId || item.productId || "";
        const product = productMap.get(targetId);
        if (!product) {
          return NextResponse.json(
            { error: "One of the products in your cart is unavailable" },
            { status: 400 }
          );
        }
        const unitKopecks = Math.round(product.price * 100);
        estimatedAmount += unitKopecks * item.quantity;
        itemUpdates.push({
          id: item.id,
          title: product.name,
          estimatedUnitPrice: unitKopecks,
          serviceId: null,
          productId: product.id,
        });
      } else {
        const targetId = item.itemId || item.serviceId || "";
        const service = serviceMap.get(targetId);
        if (!service) {
          return NextResponse.json(
            { error: "One of the services in your cart is unavailable" },
            { status: 400 }
          );
        }
        const unitKopecks =
          item.estimatedUnitPrice > 0
            ? item.estimatedUnitPrice
            : service.basePrice;
        estimatedAmount += unitKopecks * item.quantity;
        serviceQuantities.set(
          service.id,
          (serviceQuantities.get(service.id) ?? 0) + item.quantity
        );
        itemUpdates.push({
          id: item.id,
          title: service.title,
          estimatedUnitPrice: unitKopecks,
          serviceId: service.id,
          productId: null,
        });
      }
    }

    let orderNumber = "";
    const baseCount = await prisma.order.count({
      where: { status: { not: "cart" } },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      orderNumber = formatOrderNumber(baseCount + 1 + attempt);
      try {
        await prisma.$transaction(async (tx) => {
          for (const upd of itemUpdates) {
            await tx.orderItem.update({
              where: { id: upd.id },
              data: {
                title: upd.title,
                estimatedUnitPrice: upd.estimatedUnitPrice,
                serviceId: upd.serviceId,
                productId: upd.productId,
              },
            });
          }

          await tx.orderService.deleteMany({ where: { orderId: cart.id } });
          if (serviceQuantities.size > 0) {
            await tx.orderService.createMany({
              data: [...serviceQuantities.entries()].map(
                ([serviceId, quantity]) => ({
                  orderId: cart.id,
                  serviceId,
                  quantity,
                })
              ),
            });
          }

          await tx.order.update({
            where: { id: cart.id },
            data: {
              status: "pending",
              orderNumber,
              number: orderNumber,
              deadline: parsedDeadline,
              description: description || null,
              customerNote: description || null,
              estimatedAmount,
            },
          });

          await recordActivity(tx, {
            action: "create",
            entityType: "order",
            entityId: cart.id,
            title: `${orderNumber} — ${itemUpdates
              .map((u) => u.title)
              .join(", ")
              .slice(0, 180)}`,
            actorId: customer.id,
          });
        });
        break;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== "P2002" || attempt === 4) throw error;
      }
    }

    revalidatePath("/cart");
    revalidatePath("/orders");
    revalidatePath("/admin/orders");
    revalidatePath("/manager/orders");
    revalidatePath("/admin/dashboard");

    return NextResponse.json({ success: true, orderNumber });
  } catch (error) {
    console.error("Failed to checkout cart:", error);
    return NextResponse.json(
      { error: "Failed to checkout cart" },
      { status: 500 }
    );
  }
}
