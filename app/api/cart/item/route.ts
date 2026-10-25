import { NextResponse } from "next/server";
import { z } from "zod";

import { getActionTranslator } from "@/lib/action-i18n";
import { requireActiveCustomer } from "@/lib/cart";
import { MAX_CART_QUANTITY } from "@/lib/commerce";
import {
  CartOperationError,
  addCartItem,
  removeOwnedCartItem,
  updateOwnedCartItem,
} from "@/lib/cart-operations";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-body";

export const dynamic = "force-dynamic";

const addCartItemSchema = z.object({
  itemType: z.enum(["service", "product"]),
  itemId: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY).optional().default(1),
  optionIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
});

// PATCH/DELETE identify the immutable OrderItem row, not the catalog item.
const updateCartItemSchema = z.object({
  id: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

const removeCartItemSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

async function operationError(error: unknown, fallback: string) {
  if (error instanceof CartOperationError) {
    const t = await getActionTranslator();
    const status = error.code === "cartItemNotFound" ? 404 : 400;
    return NextResponse.json(
      { error: t(error.code), code: error.code },
      { status },
    );
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await readJsonBody(request, 64 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = addCartItemSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  try {
    const result = await addCartItem(customer.id, parsed.data);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    return operationError(error, "Failed to add item to cart");
  }
}

export async function PATCH(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await readJsonBody(request, 64 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = updateCartItemSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  try {
    const result = await updateOwnedCartItem(customer.id, parsed.data);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    return operationError(error, "Failed to update cart item");
  }
}

export async function DELETE(request: Request) {
  const customer = await requireActiveCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await readJsonBody(request, 64 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = removeCartItemSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart item data" }, { status: 400 });
  }

  try {
    const result = await removeOwnedCartItem(customer.id, parsed.data.id);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    return operationError(error, "Failed to delete cart item");
  }
}
