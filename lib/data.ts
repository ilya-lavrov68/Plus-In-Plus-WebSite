import type { PostModel, ServiceModel } from "@/lib/generated/prisma/models";

import { prisma } from "@/lib/prisma";

/**
 * Plain, runtime-validated view models for the public pages.
 * Every query degrades to an empty result on failure so that pages
 * render their EmptyState instead of crashing.
 */

export interface ServiceView {
  id: string;
  title: string;
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
  readTime: number;
  publishedAt: Date | null;
}

/** Shape expected by <NewsCarousel /> (structurally identical to NewsItem). */
export interface NewsItemView {
  id: string;
  title: string;
  href: string;
  imageSrc?: string;
  description?: string;
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function toServiceView(service: ServiceModel): ServiceView {
  return {
    id: service.id,
    title: service.title,
    category: service.category,
    shortDesc: service.shortDesc,
    fullDesc: service.fullDesc,
    includes: toStringArray(service.includes),
    shapes: toStringArray(service.shapes),
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
    readTime: post.readTime,
    publishedAt: post.publishedAt,
  };
}

export function toNewsItem(post: PostView): NewsItemView {
  return {
    id: post.id,
    title: post.title,
    href: `/blog/${post.slug}`,
    imageSrc: post.coverImage || undefined,
    description: post.excerpt || undefined,
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
 * The Service model has no slug column, so the dynamic `/shop/[slug]`
 * segment carries the service id.
 */
export async function getPublishedService(id: string): Promise<ServiceView | null> {
  if (!prisma) return null;

  try {
    const service = await prisma.service.findFirst({
      where: { id, isPublished: true },
    });
    return service ? toServiceView(service) : null;
  } catch (error) {
    console.error("Failed to load the service from the database:", error);
    return null;
  }
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
