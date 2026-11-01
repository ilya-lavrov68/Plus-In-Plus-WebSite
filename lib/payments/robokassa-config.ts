import type { Payload, PayloadRequest } from "payload";

import { getPayloadClient } from "@/lib/payload-native";
import { pickConfig, type ResolvedRobokassa } from "@/lib/payments/robokassa";

/**
 * Настройки Робокассы читаются из Payload → env → демо-магазин.
 * Ошибка чтения настроек не ломает оплату: используется следующий источник.
 */
export async function resolveRobokassaConfig(
  payloadInstance?: Payload,
  req?: PayloadRequest,
): Promise<ResolvedRobokassa> {
  let settings: Record<string, string> = {};
  try {
    const payload = payloadInstance ?? await getPayloadClient();
    const result = await payload.find({
      collection: "site-settings",
      depth: 0,
      pagination: false,
      overrideAccess: true,
      ...(req ? { req } : {}),
      where: { key: { like: "robokassa%" } },
    });
    settings = Object.fromEntries(result.docs.map((row) => [row.key, row.value]));
  } catch (error) {
    console.error("[robokassa] Не удалось прочитать настройки платежей:", error);
  }
  return pickConfig(settings);
}
