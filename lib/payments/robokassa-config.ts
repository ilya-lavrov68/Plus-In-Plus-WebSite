import type { PayloadTransactionClient } from "@/lib/payload-db";

import { db as database } from "@/lib/payload-db";
import { pickConfig, type ResolvedRobokassa } from "@/lib/payments/robokassa";

/**
 * Серверное разрешение конфигурации Робокассы: настройки из БД (вкладка
 * Settings — ключи robokassa*) → переменные окружения → демо-магазин.
 *
 * Отдельный модуль от lib/payments/robokassa.ts: тот — чистая логика подписей
 * без базы, она тестируется без моков и может импортироваться где угодно.
 * Сюда ходят только серверные места: выставление счёта и приём уведомлений.
 *
 * Ошибка чтения настроек не должна ломать оплату целиком: падаем на env/демо.
 */
export async function resolveRobokassaConfig(
  db?: Pick<PayloadTransactionClient, "siteSetting">,
): Promise<ResolvedRobokassa> {
  let settings: Record<string, string> = {};
  try {
    const client = db ?? database;
    const rows = await client?.siteSetting?.findMany({
      where: { key: { startsWith: "robokassa" } },
    });
    if (rows) settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    console.error("[robokassa] Не удалось прочитать настройки платежей:", error);
  }
  return pickConfig(settings);
}
