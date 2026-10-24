import { prisma } from "@/lib/prisma";
import {
  normalizePublicSiteSettings,
  PUBLIC_SITE_SETTING_KEYS,
  type PublicSiteSettings,
} from "@/lib/site-settings";

/** Fails closed to an empty object and never selects parser/payment/notification secrets. */
export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  if (!prisma) return {};

  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [...PUBLIC_SITE_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    return normalizePublicSiteSettings(rows);
  } catch (error) {
    console.error("Failed to load public site settings:", error);
    return {};
  }
}
