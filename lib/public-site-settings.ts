import { getPayloadClient } from "@/lib/payload-native";
import { normalizePublicSiteSettings, PUBLIC_SITE_SETTING_KEYS, type PublicSiteSettings } from "@/lib/site-settings";

/** Публичные ключи только allowlist; parser/payment/notification secrets не читаются. */
export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "site-settings",
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { key: { in: [...PUBLIC_SITE_SETTING_KEYS] } },
    });
    return normalizePublicSiteSettings(result.docs.map((row) => ({ key: row.key, value: row.value })));
  } catch (error) {
    console.error("Failed to load public site settings:", error);
    return {};
  }
}
