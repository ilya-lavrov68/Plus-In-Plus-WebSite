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
  "vkApiKey",
  "telegramApiKey",
  "youtubeApiKey",
  "parserInterval",
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
  "vkApiKey",
  "telegramApiKey",
  "youtubeApiKey",
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
