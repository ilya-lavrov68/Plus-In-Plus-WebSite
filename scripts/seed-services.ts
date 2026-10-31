import { db } from "@/lib/payload-db";
import { STUDIO_SERVICES } from "@/lib/studio-catalog";

interface SeedServiceSpec {
  name: string;
  slug: string;
  legacySlug?: string;
  description: string;
  /** Price in rubles (stored in DB as integer kopecks = basePrice * 100). */
  basePrice: number;
  category: "small" | "large";
  isActive: boolean;
  sortOrder: number;
  coverImage: string;
}

const services: SeedServiceSpec[] = [
  // Small designs (4)
  {
    name: "Sign Design",
    slug: "sign-design",
    description: "Professional sign design for your business facade",
    basePrice: 5000,
    category: "small",
    isActive: true,
    sortOrder: 1,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Bag Design",
    slug: "bag-design",
    description: "Custom bag design with your branding",
    basePrice: 3000,
    category: "small",
    isActive: true,
    sortOrder: 2,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Outdoor Glass Poster",
    slug: "outdoor-glass-poster",
    description: "Eye-catching poster design for outdoor display",
    basePrice: 4000,
    category: "small",
    isActive: true,
    sortOrder: 3,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Banner Design",
    slug: "banner-design",
    description: "Professional banner design for events and promotions",
    basePrice: 3500,
    category: "small",
    isActive: true,
    sortOrder: 4,
    coverImage: "/assets/placeholders/service-cover.svg",
  },

  // Large designs (4)
  {
    name: "Large Billboard on a Building",
    slug: "large-billboard-building",
    legacySlug: "large-billboard",
    description: "Large-scale billboard design for building facades",
    basePrice: 15000,
    category: "large",
    isActive: true,
    sortOrder: 5,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Rooftop Advertising",
    slug: "rooftop-advertising",
    description: "Strategic rooftop advertising design",
    basePrice: 20000,
    category: "large",
    isActive: true,
    sortOrder: 6,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Advertisement on the Fence",
    slug: "advertisement-fence",
    legacySlug: "advertisement-on-the-fence",
    description: "Fence advertising design for maximum visibility",
    basePrice: 10000,
    category: "large",
    isActive: true,
    sortOrder: 7,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
  {
    name: "Billboard",
    slug: "billboard",
    description: "Classic billboard design for high-impact advertising",
    basePrice: 12000,
    category: "large",
    isActive: true,
    sortOrder: 8,
    coverImage: "/assets/placeholders/service-cover.svg",
  },
];

async function main() {
  if (!db) {
    throw new Error(
      "Database client is not configured. Run `npm run payload:migrate` first."
    );
  }

  console.log("Seeding services through Payload…");

  for (const service of services) {
    const preset = STUDIO_SERVICES.find(
      (item) =>
        item.slug === service.slug || item.slug === service.legacySlug
    );

    // Migrate legacy slug row in place if present and no orders block it
    if (service.legacySlug) {
      const targetExists = await db.service.findUnique({
        where: { slug: service.slug },
        select: { id: true },
      });
      const legacyRow = await db.service.findUnique({
        where: { slug: service.legacySlug },
        select: { id: true },
      });
      if (legacyRow && !targetExists) {
        await db.service.update({
          where: { id: legacyRow.id },
          data: { slug: service.slug },
        });
      } else if (legacyRow && targetExists) {
        const refCount = await db.order.count({
          where: {
            OR: [
              { services: { some: { serviceId: legacyRow.id } } },
              { items: { some: { serviceId: legacyRow.id } } },
            ],
          },
        });
        if (refCount === 0) {
          await db.service.delete({ where: { id: legacyRow.id } });
        }
      }
    }

    const basePriceKopecks = Math.round(service.basePrice * 100);
    const fullDesc = preset?.fullDesc ?? service.description;
    const includes = JSON.stringify(preset?.includes ?? [service.description]);
    const shapes = JSON.stringify(preset?.shapes ?? ["Custom layout"]);
    const resultText =
      preset?.resultText ??
      "Production-ready design layout and realistic preview.";

    await db.service.upsert({
      where: { slug: service.slug },
      update: {
        title: service.name,
        shortDesc: service.description,
        fullDesc,
        includes,
        shapes,
        resultText,
        coverImage: service.coverImage,
        basePrice: basePriceKopecks,
        priceType: "from",
        currency: "RUB",
        category: service.category,
        sortOrder: service.sortOrder,
        isActive: service.isActive,
        isPublished: service.isActive,
        isOrderable: true,
      },
      create: {
        id: `svc-${service.slug}`,
        title: service.name,
        slug: service.slug,
        shortDesc: service.description,
        fullDesc,
        includes,
        shapes,
        resultText,
        coverImage: service.coverImage,
        basePrice: basePriceKopecks,
        priceType: "from",
        currency: "RUB",
        category: service.category,
        sortOrder: service.sortOrder,
        isActive: service.isActive,
        isPublished: service.isActive,
        isOrderable: true,
      },
    });

    console.log(
      `Added: ${service.name} (${service.category} — ${service.basePrice.toLocaleString("ru-RU")} ₽)`
    );
  }

  console.log("Services seeding completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db?.close();
  });
