import { NextResponse } from "next/server";

import { getActiveServices } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { localizePublicServices } from "@/lib/service-localization";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [services, locale] = await Promise.all([getActiveServices(), getRequestLocale()]);
    const localized = localizePublicServices(services, locale);
    localized.sort((a, b) => b.category.localeCompare(a.category));
    return NextResponse.json(localized, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}
