export const SITE_SETTING_KEYS = [
  "studioName",
  "studioDescription",
  "contactEmail",
  "contactPhone",
  "vkUrl",
  "telegramUrl",
  "youtubeUrl",
  "metaTitle",
  "metaDescription",
  "metaKeywords",
  "robokassaLogin",
  "robokassaPassword1",
  "robokassaPassword2",
  "robokassaTestMode",
  "robokassaHashAlgo",
  "notificationEmail",
  "telegramBotToken",
  "telegramChatId",
] as const;

export const SECRET_SITE_SETTING_KEYS = [
  "robokassaPassword1",
  "robokassaPassword2",
  "telegramBotToken",
] as const;

const allowedKeys = new Set<string>(SITE_SETTING_KEYS);
const secretKeys = new Set<string>(SECRET_SITE_SETTING_KEYS);

export function isSiteSettingKey(key: string): boolean {
  return allowedKeys.has(key);
}

export function isSecretSiteSettingKey(key: string): boolean {
  return secretKeys.has(key);
}

/** Only these values may cross the server boundary into public pages/metadata. */
export const PUBLIC_SITE_SETTING_KEYS = [
  "studioName",
  "studioDescription",
  "contactEmail",
  "contactPhone",
  "vkUrl",
  "telegramUrl",
  "youtubeUrl",
  "metaTitle",
  "metaDescription",
  "metaKeywords",
] as const;

export type PublicSiteSettingKey = (typeof PUBLIC_SITE_SETTING_KEYS)[number];
export type PublicSiteSettings = Partial<Record<PublicSiteSettingKey, string>>;

const publicKeys = new Set<string>(PUBLIC_SITE_SETTING_KEYS);
const socialKeys = new Set<string>(["vkUrl", "telegramUrl", "youtubeUrl"]);
const textLimits: Record<PublicSiteSettingKey, number> = {
  studioName: 160,
  studioDescription: 1000,
  contactEmail: 254,
  contactPhone: 64,
  vkUrl: 2048,
  telegramUrl: 2048,
  youtubeUrl: 2048,
  metaTitle: 160,
  metaDescription: 500,
  metaKeywords: 500,
};

function safeText(value: string, max: number): string | undefined {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function safeSocialUrl(value: string): string | undefined {
  const normalized = safeText(value, 2048);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Validates persisted values again; admin form input types are not a security boundary. */
export function normalizePublicSiteSettings(
  rows: Array<{ key: string; value: string }>,
): PublicSiteSettings {
  const normalized: Record<string, string> = {};

  for (const row of rows) {
    if (!publicKeys.has(row.key)) continue;
    const key = row.key as PublicSiteSettingKey;
    let value: string | undefined;

    if (socialKeys.has(key)) {
      value = safeSocialUrl(row.value);
    } else if (key === "contactEmail") {
      const candidate = safeText(row.value, textLimits[key]);
      value = candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
        ? candidate
        : undefined;
    } else if (key === "contactPhone") {
      const candidate = safeText(row.value, textLimits[key]);
      value = candidate && /^[+\d][\d\s().-]+$/.test(candidate)
        ? candidate
        : undefined;
    } else {
      value = safeText(row.value, textLimits[key]);
    }

    if (value) normalized[key] = value;
  }

  return normalized as PublicSiteSettings;
}

/**
 * Допустимые значения перечислимых настроек. Форма рисует для них `<select>`,
 * поэтому в базу не может попасть произвольная строка.
 */
export const ROBOKASSA_HASH_ALGOS = ["md5", "ripemd160", "sha256", "sha512"] as const;
export const ROBOKASSA_TEST_MODES = [
  { value: "1", label: "test" },
  { value: "0", label: "live" },
] as const;

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];
export type SettingValidation =
  | { ok: true; value: string }
  | { ok: false; code: SettingErrorCode };

export type SettingErrorCode =
  | "required"
  | "tooLong"
  | "invalidEmail"
  | "invalidUrl"
  | "invalidPhone"
  | "invalidValue"
  | "controlCharacters";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]+$/;
const TELEGRAM_TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_PATTERN = /^-?\d{1,25}$/;

const settingLimits: Record<SiteSettingKey, number> = {
  ...textLimits,
  robokassaLogin: 64,
  robokassaPassword1: 128,
  robokassaPassword2: 128,
  robokassaTestMode: 1,
  robokassaHashAlgo: 16,
  notificationEmail: 254,
  telegramBotToken: 128,
  telegramChatId: 32,
};

/**
 * Проверяет значение одной настройки до записи в базу.
 *
 * Раньше форма сохраняла что угодно: опечатка в URL или e-mail тихо попадала в
 * `site_settings`, публичный слой её отбрасывал, и со стороны админки это
 * выглядело как «сохранилось, но не работает». Теперь такие значения
 * отклоняются с кодом ошибки, который страница показывает рядом с полем.
 */
export function validateSiteSettingValue(key: SiteSettingKey, rawValue: string): SettingValidation {
  const raw = rawValue.trim();
  const limit = settingLimits[key];
  if (raw.length > limit) return { ok: false, code: "tooLong" };
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false, code: "controlCharacters" };

  const isSecret = isSecretSiteSettingKey(key);
  if (raw === "" && isSecret) {
    // Пустой секрет означает «не менять» и обрабатывается вызывающим кодом.
    return { ok: true, value: "" };
  }

  switch (key) {
    case "contactEmail":
    case "notificationEmail":
      return EMAIL_PATTERN.test(raw) ? { ok: true, value: raw } : raw === "" ? { ok: true, value: "" } : { ok: false, code: "invalidEmail" };
    case "contactPhone":
      return PHONE_PATTERN.test(raw) ? { ok: true, value: raw } : raw === "" ? { ok: true, value: "" } : { ok: false, code: "invalidPhone" };
    case "vkUrl":
    case "telegramUrl":
    case "youtubeUrl": {
      if (raw === "") return { ok: true, value: "" };
      try {
        const url = new URL(raw);
        if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
          return { ok: false, code: "invalidUrl" };
        }
        return { ok: true, value: url.toString() };
      } catch {
        return { ok: false, code: "invalidUrl" };
      }
    }
    case "robokassaTestMode":
      return raw === "0" || raw === "1" ? { ok: true, value: raw } : { ok: false, code: "invalidValue" };
    case "robokassaHashAlgo":
      return (ROBOKASSA_HASH_ALGOS as readonly string[]).includes(raw.toLowerCase())
        ? { ok: true, value: raw.toLowerCase() }
        : { ok: false, code: "invalidValue" };
    case "telegramBotToken":
      return raw === "" || TELEGRAM_TOKEN_PATTERN.test(raw) ? { ok: true, value: raw } : { ok: false, code: "invalidValue" };
    case "telegramChatId":
      return raw === "" || TELEGRAM_CHAT_PATTERN.test(raw) ? { ok: true, value: raw } : { ok: false, code: "invalidValue" };
    default:
      // Публичный текст: схлопываем повторные пробелы, как и при чтении.
      return { ok: true, value: raw.replace(/\s+/g, " ") };
  }
}
