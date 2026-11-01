import type { MetadataRoute } from "next";

import { getSitemapPosts, getSitemapServices, serviceHref } from "@/lib/data";
import { getPayloadClient } from "@/lib/payload-native";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, posts, activeProductCount] = await Promise.all([
    getSitemapServices(),
    getSitemapPosts(),
    (async () => {
      try {
        const payload = await getPayloadClient();
        const result = await payload.count({
          collection: "products",
          overrideAccess: true,
          where: { isActive: { equals: true } },
        });
        return result.totalDocs;
      } catch (error) {
        console.error("Failed to count shop products for the sitemap:", error);
        return 0;
      }
    })(),
  ]);

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/ai"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/ai/lumi"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/ai/kairo"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/services"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/contact"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/blog"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Пустой /shop остаётся noindex; каталог появляется в sitemap вместе
    // с первым активным товаром. Страницы услуг не зависят от магазина.
    ...(activeProductCount > 0
      ? [
          {
            url: absoluteUrl("/shop"),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          },
        ]
      : []),
    ...["/privacy", "/terms"].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
    ...services.map((service) => ({
      url: absoluteUrl(serviceHref(service)),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${encodeURIComponent(post.slug)}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
      ...(post.publishedAt ? { lastModified: post.publishedAt } : {}),
    })),
  ];
}
