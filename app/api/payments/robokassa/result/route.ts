import { handleRobokassaResult, robokassaResultHealth } from "@/lib/payments/robokassa-result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Result URL Робокассы (основной адрес — он прописан в личном кабинете
 * магазина и в .env.example). Вся логика — в lib/payments/robokassa-result,
 * здесь только тонкая обёртка маршрута.
 */
export async function POST(request: Request): Promise<Response> {
  return handleRobokassaResult(request);
}

/** Робокасса проверяет доступность Result URL запросом GET. */
export async function GET(): Promise<Response> {
  return robokassaResultHealth();
}
