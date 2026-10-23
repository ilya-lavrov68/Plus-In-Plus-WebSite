import { NextResponse } from "next/server";

import {
  enrichCartItems,
  getOrCreateCartOrder,
  requireActiveCustomer,
} from "@/lib/cart";
import { getRequestLocale } from "@/lib/request-locale";

export const dynamic = "force-dynamic";

export async function GET() {
  const customer = await requireActiveCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [cart, locale] = await Promise.all([
      getOrCreateCartOrder(customer.id),
      getRequestLocale(),
    ]);

    const enrichedItems = await enrichCartItems(cart.items, locale);
    const count = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);

    return NextResponse.json(
      {
        id: cart.id,
        deadline: cart.deadline,
        description: cart.description,
        items: enrichedItems,
        count,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to load cart:", error);
    return NextResponse.json(
      { error: "Failed to load cart" },
      { status: 500 }
    );
  }
}
