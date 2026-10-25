import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getActionTranslator } from "@/lib/action-i18n";
import { requireActiveCustomer } from "@/lib/cart";
import { CartOperationError, checkoutOwnedCart } from "@/lib/cart-operations";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-origin";
import { logServerError } from "@/lib/security-log";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  deadline: z.string().trim().max(64).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const customer = await requireActiveCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await readJsonBody(request, 32 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = checkoutSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout data" }, { status: 400 });
  }

  try {
    const result = await checkoutOwnedCart(customer.id, {
      deadline: parsed.data.deadline,
      note: parsed.data.description,
    });

    revalidatePath("/cart");
    revalidatePath("/cart");
    revalidatePath("/admin/orders");
    revalidatePath("/manager/orders");
    revalidatePath("/admin/dashboard");
    return NextResponse.json({ success: true, orderNumber: result.orderNumber });
  } catch (error) {
    if (error instanceof CartOperationError) {
      const t = await getActionTranslator();
      return NextResponse.json(
        { error: t(error.code), code: error.code },
        { status: 400 },
      );
    }
    logServerError("cart.checkout_failed", error);
    return NextResponse.json({ error: "Failed to checkout cart" }, { status: 500 });
  }
}
