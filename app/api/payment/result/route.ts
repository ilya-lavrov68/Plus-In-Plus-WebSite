import { handleRobokassaResult, robokassaResultHealth } from "@/lib/payments/robokassa-result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Result URL по адресу из ТЗ (/api/payment/result). Обработчик тот же, что и
 * у /api/payments/robokassa/result: в кабинете Робокассы можно указать любой
 * из двух — зачисление произойдёт одинаково, дублей не будет (повторное
 * уведомление по уже оплаченному счёту игнорируется).
 */
export async function POST(request: Request): Promise<Response> {
  return handleRobokassaResult(request);
}

/** Робокасса проверяет доступность Result URL запросом GET. */
export async function GET(): Promise<Response> {
  return robokassaResultHealth();
}
