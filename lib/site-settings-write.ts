import { run } from "@/lib/db";
import { isSecretSiteSettingKey, isSiteSettingKey } from "@/lib/site-settings";

/**
 * Запись настроек сайта.
 *
 * Раньше это была вкладка Settings в CMS и доступна она была только основателю.
 * Правила те же: пишем только allowlist-ключи, секреты не логируем и не
 * возвращаем наружу, пустое значение означает «оставить как было».
 */

export class SiteSettingError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "SiteSettingError";
  }
}

const MAX_VALUE_LENGTH = 2000;

export async function saveSiteSettings(input: Record<string, string>): Promise<string[]> {
  const updates: Array<{ key: string; value: string }> = [];

  for (const [key, rawValue] of Object.entries(input)) {
    if (!isSiteSettingKey(key)) continue;
    const value = rawValue.trim();
    // Пустая строка для секрета — «не менять»: пользователь не должен стирать
    // ключ платежей, просто сохранив форму.
    if (value === "" && isSecretSiteSettingKey(key)) continue;
    if (value.length > MAX_VALUE_LENGTH) {
      throw new SiteSettingError(`Слишком длинное значение: ${key}`, "too_long");
    }
    updates.push({ key, value });
  }

  if (updates.length === 0) return [];

  const now = new Date().toISOString();
  for (const { key, value } of updates) {
    const changed = await run(`update site_settings set value = ?, updated_at = ? where "key" = ?`, [value, now, key]);
    if (changed === 0) {
      await run(
        `insert into site_settings (id, "key", value, created_at, updated_at) values (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), key, value, now, now],
      );
    }
  }
  return updates.map((update) => update.key);
}
