import { NextResponse } from "next/server";

import { toPublicServiceItem } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { localizePublicServices } from "@/lib/service-localization";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!prisma) {
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [services, locale] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        orderBy: [
          { category: "desc" },
          { sortOrder: "asc" },
          { title: "asc" },
        ],
      }),
      getRequestLocale(),
    ]);

    const localized = localizePublicServices(
      services.map(toPublicServiceItem),
      locale
    );

    return NextResponse.json(localized, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
