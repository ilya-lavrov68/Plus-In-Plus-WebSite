import { row, run } from "@/lib/db";
import {
  isSecretSiteSettingKey,
  isSiteSettingKey,
  validateSiteSettingValue,
  type SiteSettingKey,
} from "@/lib/site-settings";

/**
 * Запись настроек сайта.
 *
 * Раньше это была вкладка Settings в CMS и доступна она была только основателю.
 * Правила те же: пишем только allowlist-ключи, секреты не логируем и не
 * возвращаем наружу, пустое значение означает «оставить как было».
 */

export class SiteSettingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly key?: string,
  ) {
    super(message);
    this.name = "SiteSettingError";
  }
}

const MAX_VALUE_LENGTH = 2000;

export interface SaveSiteSettingsResult {
  /** Ключи, у которых значение действительно изменилось. */
  changed: string[];
  /** Ключи, которые форма прислала без изменений. */
  unchanged: string[];
  /** Ключи, которые попросили очистить. */
  cleared: string[];
}

export interface SaveSiteSettingsOptions {
  /** Ключи с префиксом `clear:` — удалить значение из базы. */
  clear?: ReadonlySet<string>;
}

export async function saveSiteSettings(
  input: Record<string, string>,
  options: SaveSiteSettingsOptions = {},
): Promise<string[]> {
  const result = await saveSiteSettingsDetailed(input, options);
  return result.changed;
}

/**
 * Развёрнутый вариант записи: сообщает, что изменилось, что осталось прежним и
 * что очищено. Нужен странице настроек, чтобы честно показать результат
 * сохранения, а не безусловное «Сохранено».
 */
export async function saveSiteSettingsDetailed(
  input: Record<string, string>,
  options: SaveSiteSettingsOptions = {},
): Promise<SaveSiteSettingsResult> {
  const updates: Array<{ key: SiteSettingKey; value: string }> = [];
  const unchanged: string[] = [];
  const cleared: string[] = [];
  const clear = options.clear ?? new Set<string>();

  for (const key of clear) {
    if (isSiteSettingKey(key)) cleared.push(key);
  }

  for (const [key, rawValue] of Object.entries(input)) {
    if (!isSiteSettingKey(key)) continue;
    const settingKey = key as SiteSettingKey;
    const value = rawValue.trim();

    if (clear.has(key)) {
      cleared.push(key);
      continue;
    }

    // Пустая строка для секрета — «не менять»: пользователь не должен стирать
    // ключ платежей, просто сохранив форму.
    if (value === "" && isSecretSiteSettingKey(key)) {
      unchanged.push(key);
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) {
      throw new SiteSettingError(`Слишком длинное значение: ${key}`, "tooLong", key);
    }

    const validation = validateSiteSettingValue(settingKey, value);
    if (!validation.ok) {
      throw new SiteSettingError(`Некорректное значение: ${key}`, validation.code, key);
    }

    updates.push({ key: settingKey, value: validation.value });
  }

  const changed: string[] = [];
  const now = new Date().toISOString();

  for (const { key, value } of updates) {
    const current = await row<{ value: string } | undefined>(
      `select value from site_settings where "key" = ? limit 1`,
      [key],
    );
    if (current && String(current.value ?? "") === value) {
      unchanged.push(key);
      continue;
    }
    if (current) {
      await run(`update site_settings set value = ?, updated_at = ? where "key" = ?`, [value, now, key]);
    } else {
      await run(
        `insert into site_settings (id, "key", value, created_at, updated_at) values (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), key, value, now, now],
      );
    }
    changed.push(key);
  }

  for (const key of cleared) {
    const removed = await run(`delete from site_settings where "key" = ?`, [key]);
    if (removed > 0) changed.push(key);
    else unchanged.push(key);
  }

  return { changed, unchanged, cleared };
}
