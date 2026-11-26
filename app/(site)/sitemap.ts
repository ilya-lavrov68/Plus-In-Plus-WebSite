import type { MetadataRoute } from "next";

import { rows } from "@/lib/db";
import { getSitemapPosts, getSitemapServices, serviceHref } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, posts, activeProductCount] = await Promise.all([
    getSitemapServices(),
    getSitemapPosts(),
    (async () => {
      try {
        const found = await rows<{ total: number }>(`select count(*) total from products where is_active = 1`);
        return Number(found[0]?.total ?? 0);
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
      url: absoluteUrl("/line-launcher"),
      changeFrequency: "monthly",
      priority: 0.9,
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
