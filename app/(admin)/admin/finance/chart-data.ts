"use server";

import { isFinanceKind, isFinanceRange, loadFinancePayload, type FinancePayload } from "@/lib/admin-finance";
import { requireStaff } from "@/lib/admin-session";

/**
 * Данные для графиков по запросу.
 *
 * Файл назван не `actions.ts`: в панели так называются только те серверные
 * модули, которые меняют данные, и их список закреплён тестом
 * `founder-protection`. Здесь одни чтения — но права проверяются всё равно,
 * потому что серверное действие открыто по своему идентификатору.
 *
 * Диапазон переключается на клиенте, но выборка остаётся серверной: браузер не
 * ходит в базу и не получает доступ к лишним строкам — он просит агрегат по
 * конкретному графику и периоду. Права проверяются на каждом вызове, потому что
 * серверное действие — такая же открытая точка входа, как и страница.
 */
export async function loadFinanceChart(kind: string, range: string): Promise<FinancePayload> {
  const staff = await requireStaff();
  if (!staff) throw new Error("unauthorized");
  if (!isFinanceKind(kind) || !isFinanceRange(range)) throw new Error("bad-request");

  const days = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 }[range];
  return loadFinancePayload(kind, days);
}
