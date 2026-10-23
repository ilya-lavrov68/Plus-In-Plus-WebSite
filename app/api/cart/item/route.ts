import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getOrCreateCartOrder,
  requireActiveCustomer,
  syncCartEstimatedAmount,
} from "@/lib/cart";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_QUANTITY = 99;

const addCartItemSchema = z.object({
  itemType: z.enum(["service", "product"]),
  itemId: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(1).max(MAX_QUANTITY).optional().default(1),
});

const updateCartItemSchema = z.object({
  itemType: z.enum(["service", "product"]),
  itemId: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});

const removeCartItemSchema = z.object({
  itemType: z.enum(["service", "product"]),
  itemId: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = addCartItemSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  const { itemType, itemId, quantity } = parsed.data;

  try {
    let title = "";
    let estimatedUnitPrice = 0;

    if (itemType === "service") {
      const service = await prisma.service.findFirst({
        where: { id: itemId, isActive: true },
        select: { id: true, title: true, basePrice: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      title = service.title;
      estimatedUnitPrice = service.basePrice;
    } else {
      const product = await prisma.product.findFirst({
        where: { id: itemId, isActive: true },
        select: { id: true, name: true, price: true },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      title = product.name;
      estimatedUnitPrice = Math.round(product.price * 100);
    }

    const cart = await getOrCreateCartOrder(customer.id);

    const existing = await prisma.orderItem.findFirst({
      where: { orderId: cart.id, itemType, itemId },
    });

    if (existing) {
      const nextQuantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
      await prisma.orderItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQuantity,
          title,
          estimatedUnitPrice,
        },
      });
    } else {
      await prisma.orderItem.create({
        data: {
          orderId: cart.id,
          itemType,
          itemId,
          serviceId: itemType === "service" ? itemId : null,
          productId: itemType === "product" ? itemId : null,
          title,
          quantity,
          estimatedUnitPrice,
        },
      });
    }

    const count = await syncCartEstimatedAmount(cart.id);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Failed to add item to cart:", error);
    return NextResponse.json(
      { error: "Failed to add item to cart" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateCartItemSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  const { itemType, itemId, quantity } = parsed.data;

  try {
    const cart = await prisma.order.findFirst({
      where: { userId: customer.id, status: "cart" },
      orderBy: { createdAt: "desc" },
    });
    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    await prisma.orderItem.updateMany({
      where: { orderId: cart.id, itemType, itemId },
      data: { quantity },
    });

    const count = await syncCartEstimatedAmount(cart.id);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Failed to update cart item:", error);
    return NextResponse.json(
      { error: "Failed to update cart item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = removeCartItemSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  const { itemId, itemType } = parsed.data;

  try {
    const cart = await prisma.order.findFirst({
      where: { userId: customer.id, status: "cart" },
      orderBy: { createdAt: "desc" },
    });

    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    await prisma.orderItem.deleteMany({
      where: { orderId: cart.id, itemId, itemType },
    });

    const count = await syncCartEstimatedAmount(cart.id);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Failed to delete cart item:", error);
    return NextResponse.json(
      { error: "Failed to delete cart item" },
      { status: 500 }
    );
  }
}
