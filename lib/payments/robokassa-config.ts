import { listSiteSettings } from "@/lib/commerce-data";
import { pickConfig, type ResolvedRobokassa } from "@/lib/payments/robokassa";

/**
 * Настройки Робокассы читаются из `site_settings` → env → демо-магазин.
 * Ошибка чтения настроек не ломает оплату: используется следующий источник.
 */
export async function resolveRobokassaConfig(): Promise<ResolvedRobokassa> {
  let settings: Record<string, string> = {};
  try {
    settings = await listSiteSettings("robokassa");
  } catch (error) {
    console.error("[robokassa] Не удалось прочитать настройки платежей:", error);
  }
  return pickConfig(settings);
}
