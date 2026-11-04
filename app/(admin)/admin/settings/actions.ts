"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireFounder } from "@/lib/admin-session";
import { listSiteSettings } from "@/lib/commerce-data";
import { sendTelegramTest } from "@/lib/notifications";
import { saveSiteSettingsDetailed, SiteSettingError } from "@/lib/site-settings-write";

/**
 * Сохранение настроек сайта. Доступно только основателю: здесь платёжные
 * ключи и токены уведомлений. Значения секретов не пишутся в журнал.
 *
 * Редирект несёт честный результат: `saved=<сколько изменилось>` либо
 * `error=<код>&field=<ключ>`. Страница показывает «изменений нет», ошибку у
 * конкретного поля или количество сохранённых значений.
 */
export async function saveSettings(formData: FormData): Promise<void> {
  const founder = await requireFounder();
  if (!founder) return;

  const values: Record<string, string> = {};
  const clear = new Set<string>();
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("clear:")) {
      if (value === "1") clear.add(key.slice("clear:".length));
      continue;
    }
    values[key] = value;
  }

  let result;
  try {
    result = await saveSiteSettingsDetailed(values, { clear });
  } catch (error) {
    if (error instanceof SiteSettingError) {
      const field = error.key ? `&field=${encodeURIComponent(error.key)}` : "";
      redirect(`/admin/settings?error=${encodeURIComponent(error.code)}${field}`);
    }
    throw error;
  }

  if (result.changed.length > 0) {
    // В журнал попадают только имена настроек — без значений.
    await logAdminAction({
      action: "settings.updated",
      entityType: "setting",
      entityId: "site_settings",
      title: `Настройки: ${result.changed.sort().join(", ")}`,
      actorId: founder.id,
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  redirect(`/admin/settings?saved=${result.changed.length}`);
}

/**
 * Проверка Telegram-уведомлений прямо из формы: значения берутся из тех же
 * полей, поэтому проверить можно и до сохранения.
 */
export async function testNotifications(formData: FormData): Promise<void> {
  const founder = await requireFounder();
  if (!founder) return;

  const stored = await listSiteSettings("telegram");
  const botToken = String(formData.get("telegramBotToken") ?? "").trim() || stored.telegramBotToken || "";
  const chatId = String(formData.get("telegramChatId") ?? "").trim() || stored.telegramChatId || "";

  const result = await sendTelegramTest(botToken && chatId ? { botToken, chatId } : null);
  if (!result.ok) {
    console.warn(`[admin] telegram test failed: ${result.reason}`);
  }

  revalidatePath("/admin/settings");
  redirect(`/admin/settings?test=${result.ok ? "ok" : result.reason}`);
}
