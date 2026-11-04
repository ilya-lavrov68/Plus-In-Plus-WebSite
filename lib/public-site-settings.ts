import { rows } from "@/lib/db";
import { normalizePublicSiteSettings, PUBLIC_SITE_SETTING_KEYS, type PublicSiteSettings } from "@/lib/site-settings";

/**
 * Публичные настройки читаются прямо из `site_settings` и только по allowlist:
 * parser/payment/notification secrets в запрос не попадают вообще.
 */
export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const keys = [...PUBLIC_SITE_SETTING_KEYS];
    if (keys.length === 0) return {};
    const settings = await rows<{ key: string; value: string }>(
      `select key, value from site_settings where key in (${keys.map(() => "?").join(", ")})`,
      keys,
    );
    return normalizePublicSiteSettings(settings.map((setting) => ({ key: setting.key, value: setting.value })));
  } catch (error) {
    console.error("Failed to load public site settings:", error);
    return {};
  }
}
