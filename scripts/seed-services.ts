import { closePayloadClient, getPayloadClient } from "@/lib/payload-native";
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
  const payload = await getPayloadClient();
  console.log("Seeding services through Payload…");

  const findBySlug = async (slug: string) => {
    const result = await payload.find({
      collection: "services",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: slug } },
    });
    return result.docs[0] ?? null;
  };

  for (const service of services) {
    const preset = STUDIO_SERVICES.find(
      (item) => item.slug === service.slug || item.slug === service.legacySlug,
    );

    if (service.legacySlug) {
      const [targetExists, legacyRow] = await Promise.all([
        findBySlug(service.slug),
        findBySlug(service.legacySlug),
      ]);
      if (legacyRow && !targetExists) {
        await payload.update({
          collection: "services",
          id: legacyRow.id,
          data: { slug: service.slug },
          overrideAccess: true,
        });
      } else if (legacyRow && targetExists) {
        const [serviceLinks, itemLinks] = await Promise.all([
          payload.count({
            collection: "order-services",
            overrideAccess: true,
            where: { serviceId: { equals: legacyRow.id } },
          }),
          payload.count({
            collection: "order-items",
            overrideAccess: true,
            where: { serviceId: { equals: legacyRow.id } },
          }),
        ]);
        if (serviceLinks.totalDocs + itemLinks.totalDocs === 0) {
          await payload.delete({ collection: "services", id: legacyRow.id, overrideAccess: true });
        }
      }
    }

    const fullDesc = preset?.fullDesc ?? service.description;
    const includes = (preset?.includes ?? [service.description]).map((value) => ({ value }));
    const shapes = (preset?.shapes ?? ["Custom layout"]).map((value) => ({ value }));
    const resultText = preset?.resultText ?? "Production-ready design layout and realistic preview.";
    const data = {
      title: service.name,
      shortDesc: service.description,
      fullDesc,
      includes,
      shapes,
      resultText,
      coverImage: service.coverImage,
      basePrice: Math.round(service.basePrice * 100),
      priceType: "from" as const,
      currency: "RUB",
      category: service.category,
      sortOrder: service.sortOrder,
      isActive: service.isActive,
      isPublished: service.isActive,
      isOrderable: true,
    };
    const existing = await findBySlug(service.slug);
    if (existing) {
      await payload.update({ collection: "services", id: existing.id, data, overrideAccess: true });
    } else {
      await payload.create({
        collection: "services",
        data: { id: `svc-${service.slug}`, slug: service.slug, ...data },
        overrideAccess: true,
      });
    }

    console.log(
      `Added: ${service.name} (${service.category} — ${service.basePrice.toLocaleString("ru-RU")} ₽)`,
    );
  }
  console.log("Services seeding completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePayloadClient);
