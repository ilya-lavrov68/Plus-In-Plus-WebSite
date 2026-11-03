"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireFounder } from "@/lib/admin-session";
import { saveSiteSettings, SiteSettingError } from "@/lib/site-settings-write";

/**
 * Сохранение настроек сайта. Доступно только основателю: здесь платёжные
 * ключи и токены уведомлений. Значения секретов не пишутся в журнал.
 */
export async function saveSettings(formData: FormData): Promise<void> {
  const founder = await requireFounder();
  if (!founder) return;

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }

  let changedKeys: string[];
  try {
    changedKeys = await saveSiteSettings(values);
  } catch (error) {
    if (error instanceof SiteSettingError) {
      redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  if (changedKeys.length > 0) {
    // В журнал попадают только имена настроек — без значений.
    await logAdminAction({
      action: "settings.updated",
      entityType: "setting",
      entityId: "site_settings",
      title: `Настройки: ${changedKeys.sort().join(", ")}`,
      actorId: founder.id,
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  redirect("/admin/settings?saved=1");
}
