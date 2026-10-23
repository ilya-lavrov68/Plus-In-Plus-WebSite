import fs from "node:fs";
import path from "node:path";

import { Community3 } from "@/components/blocks/community3";
import { getRequestTranslations } from "@/lib/server-i18n";

function resolveTsConnectLogoSrc(): string {
  try {
    const logosDir = path.join(process.cwd(), "public", "assets", "logos");
    const files = fs.readdirSync(logosDir);
    const customTsLogo = files.find((name) => {
      const lower = name.toLowerCase();
      if (
        lower === ".gitkeep" ||
        lower === "readme.md" ||
        lower === "lnpip.svg" ||
        lower === "npip.svg" ||
        lower === "ts-connect.svg"
      ) {
        return false;
      }
      return /\.(svg|png|webp|jpg|jpeg)$/i.test(lower);
    });
    if (customTsLogo) {
      return `/assets/logos/${customTsLogo}`;
    }
  } catch {
    // Fallback to default bundled TS Connect SVG
  }
  return "/assets/logos/ts-connect.svg";
}

export async function Community() {
  const t = await getRequestTranslations("home");
  const tsConnectLogoSrc = resolveTsConnectLogoSrc();
  return (
    <Community3
      tsConnectLogoSrc={tsConnectLogoSrc}
      badge={t("communityBadge")}
      heading={t("communityHeading")}
      description={t("communityDescription")}
      studioDescription={t("pipDescription")}
      partnerDescription={t("tsConnectDescription")}
    />
  );
}
