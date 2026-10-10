import type { MetadataRoute } from "next";

import { getPublishedPosts, getPublishedServices } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, posts] = await Promise.all([
    getPublishedServices(),
    getPublishedPosts(),
  ]);

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/shop"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/blog"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...services.map((service) => ({
      url: absoluteUrl(`/shop/${encodeURIComponent(service.id)}`),
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
