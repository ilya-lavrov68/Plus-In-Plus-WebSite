import { NextResponse } from "next/server";

import { getCartCount } from "@/lib/cart";

export const dynamic = "force-dynamic";

/**
 * Счётчик корзины для бейджа в шапке.
 *
 * Шапка — клиентский компонент, а количество живёт в БД, поэтому бейдж
 * спрашивает его отдельным лёгким запросом (и обновляется по событию
 * `pip:cart-updated` после каждого действия с корзиной).
 */
export async function GET() {
  const count = await getCartCount();
  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
