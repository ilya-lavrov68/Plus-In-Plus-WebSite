import { randomUUID } from "node:crypto";

import { closeDb, rows, run, withTransaction, type SqlExecutor } from "@/lib/db";
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

interface ServiceRow {
  id: string;
}

async function findBySlug(slug: string, exec: SqlExecutor): Promise<ServiceRow | null> {
  const found = await exec.rows<ServiceRow>(`select id from services where slug = ? limit 1`, [slug]);
  return found[0] ?? null;
}

/** Списки `includes` и `shapes` — дочерние таблицы: переписываем их целиком. */
async function replaceList(
  table: "services_includes" | "services_shapes",
  serviceId: string,
  values: readonly string[],
  exec: SqlExecutor,
): Promise<void> {
  await exec.run(`delete from ${table} where _parent_id = ?`, [serviceId]);
  let order = 0;
  for (const value of values) {
    await exec.run(
      `insert into ${table} (_order, _parent_id, id, value) values (?, ?, ?, ?)`,
      [order++, serviceId, randomUUID(), value],
    );
  }
}

async function main() {
  console.log("Seeding services into the database…");

  for (const service of services) {
    const preset = STUDIO_SERVICES.find(
      (item) => item.slug === service.slug || item.slug === service.legacySlug,
    );

    if (service.legacySlug) {
      const [targetExists, legacyRow] = await Promise.all([
        findBySlug(service.slug, { rows, run }),
        findBySlug(service.legacySlug, { rows, run }),
      ]);
      if (legacyRow && !targetExists) {
        await run(`update services set slug = ?, updated_at = ? where id = ?`, [
          service.slug,
          new Date().toISOString(),
          legacyRow.id,
        ]);
      } else if (legacyRow && targetExists) {
        const [serviceLinks, itemLinks] = await Promise.all([
          rows<{ total: number }>(`select count(*) total from order_services where service_id_id = ?`, [legacyRow.id]),
          rows<{ total: number }>(`select count(*) total from order_items where service_id_id = ?`, [legacyRow.id]),
        ]);
        const linked = Number(serviceLinks[0]?.total ?? 0) + Number(itemLinks[0]?.total ?? 0);
        // Удалять услугу со связанными заказами нельзя: история заказов важнее.
        if (linked === 0) {
          await run(`delete from services where id = ?`, [legacyRow.id]);
        }
      }
    }

    const fullDesc = preset?.fullDesc ?? service.description;
    const includes = preset?.includes ?? [service.description];
    const shapes = preset?.shapes ?? ["Custom layout"];
    const resultText = preset?.resultText ?? "Production-ready design layout and realistic preview.";

    await withTransaction(async (tx) => {
      const existing = await findBySlug(service.slug, tx);
      const id = existing?.id ?? `svc-${service.slug}`;
      const now = new Date().toISOString();
      const values = [
        service.name,
        service.slug,
        service.category,
        service.description,
        fullDesc,
        resultText,
        service.coverImage,
        Math.round(service.basePrice * 100),
        "from",
        "RUB",
        1,
        service.isActive ? 1 : 0,
        service.isActive ? 1 : 0,
        service.sortOrder,
      ];
      if (existing) {
        await tx.run(
          `update services set title = ?, slug = ?, category = ?, short_desc = ?, full_desc = ?, result_text = ?,
             cover_image = ?, base_price = ?, price_type = ?, currency = ?, is_orderable = ?, is_published = ?,
             is_active = ?, sort_order = ?, updated_at = ?
           where id = ?`,
          [...values, now, id],
        );
      } else {
        await tx.run(
          `insert into services (id, title, slug, category, short_desc, full_desc, result_text, cover_image,
             base_price, price_type, currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, ...values, now, now],
        );
      }
      await replaceList("services_includes", id, includes, tx);
      await replaceList("services_shapes", id, shapes, tx);
    });

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
  .finally(closeDb);
