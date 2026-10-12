import type { PostModel, ServiceModel } from "@/lib/generated/prisma/models";

import { parseJsonArray } from "@/lib/db-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Plain, runtime-validated view models for the public pages.
 * Every query degrades to an empty result on failure so that pages
 * render their EmptyState instead of crashing.
 */

export interface ServiceView {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc: string;
  fullDesc: string;
  includes: string[];
  shapes: string[];
  resultText: string;
  coverImage: string;
}

export interface PostView {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  images?: string | null;
  readTime: number;
  source: string;
  sourceUrl?: string | null;
  isFeatured?: boolean;
  publishedAt: Date | null;
}

export type NewsSource = "vk" | "telegram" | "youtube" | "manual";

/** Data shared by the landing-page news cards and the legacy article carousel. */
export interface NewsItemView {
  id: string;
  title: string;
  href: string;
  postUrl?: string;
  sourceUrl?: string | null;
  imageSrc?: string;
  excerpt: string;
  source: NewsSource;
  description?: string;
  imagesCount?: number;
}

function toServiceView(service: ServiceModel): ServiceView {
  return {
    id: service.id,
    title: service.title,
    slug: service.slug,
    category: service.category,
    shortDesc: service.shortDesc,
    fullDesc: service.fullDesc,
    includes: parseJsonArray(service.includes),
    shapes: parseJsonArray(service.shapes),
    resultText: service.resultText,
    coverImage: service.coverImage,
  };
}

function toPostView(post: PostModel): PostView {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    images: post.images ?? null,
    readTime: post.readTime,
    source: post.source,
    sourceUrl: post.sourceUrl ?? null,
    isFeatured: post.isFeatured ?? false,
    publishedAt: post.publishedAt,
  };
}

function toNewsSource(source: string): NewsSource {
  const normalized = source.trim().toLowerCase();
  if (normalized === "telegram") return "telegram";
  if (normalized === "youtube" || normalized === "you tube" || normalized === "yt") return "youtube";
  if (normalized === "vk" || normalized === "vkontakte") return "vk";
  return "manual";
}

export function toNewsItem(post: PostView): NewsItemView {
  const additionalImages = post.images ? parseJsonArray(post.images) : [];
  return {
    id: post.id,
    title: post.title,
    href: `/blog/${post.slug}`,
    postUrl: `/blog/${post.slug}`,
    sourceUrl: post.sourceUrl ?? null,
    imageSrc: post.coverImage || undefined,
    excerpt: post.excerpt,
    source: toNewsSource(post.source),
    description: post.excerpt || undefined,
    imagesCount: additionalImages.length,
  };
}

export async function getPublishedServices(): Promise<ServiceView[]> {
  if (!prisma) return [];

  try {
    const services = await prisma.service.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "asc" },
    });
    return services.map(toServiceView);
  } catch (error) {
    console.error("Failed to load services from the database:", error);
    return [];
  }
}

/**
 * `/shop/[slug]` accepts the service slug (canonical) or, for links created before
 * slugs existed, the service id.
 */
export async function getPublishedService(slugOrId: string): Promise<ServiceView | null> {
  if (!prisma) return null;

  try {
    const service = await prisma.service.findFirst({
      where: {
        isPublished: true,
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
    });
    return service ? toServiceView(service) : null;
  } catch (error) {
    console.error("Failed to load the service from the database:", error);
    return null;
  }
}

/** Public URL of a service row; falls back to the id for legacy rows. */
export function serviceHref(service: Pick<ServiceView, "id" | "slug">): string {
  return `/shop/${encodeURIComponent(service.slug || service.id)}`;
}

export async function getPublishedPosts(): Promise<PostView[]> {
  if (!prisma) return [];

  try {
    const posts = await prisma.post.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });
    return posts.map(toPostView);
  } catch (error) {
    console.error("Failed to load posts from the database:", error);
    return [];
  }
}

export async function getPublishedPost(slug: string): Promise<PostView | null> {
  if (!prisma) return null;

  try {
    const post = await prisma.post.findFirst({
      where: { slug, isPublished: true },
    });
    return post ? toPostView(post) : null;
  } catch (error) {
    console.error("Failed to load the post from the database:", error);
    return null;
  }
}

export async function getFeaturedPost(): Promise<PostView | null> {
  if (!prisma) return null;

  try {
    let post = await prisma.post.findFirst({
      where: { isPublished: true, isFeatured: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });
    if (!post) {
      post = await prisma.post.findFirst({
        where: { isPublished: true },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      });
    }
    return post ? toPostView(post) : null;
  } catch (error) {
    console.error("Failed to load featured post from the database:", error);
    return null;
  }
}
