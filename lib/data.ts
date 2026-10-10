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
  source: string;
  publishedAt: Date | null;
}

export type NewsSource = "vk" | "telegram" | "youtube";

/** Data shared by the landing-page news cards and the legacy article carousel. */
export interface NewsItemView {
  id: string;
  title: string;
  href: string;
  imageSrc?: string;
  excerpt: string;
  source: NewsSource;
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
    source: post.source,
    publishedAt: post.publishedAt,
  };
}

function toNewsSource(source: string): NewsSource {
  const normalized = source.trim().toLowerCase();
  if (normalized === "telegram") return "telegram";
  if (normalized === "youtube" || normalized === "you tube" || normalized === "yt") return "youtube";
  return "vk";
}

export function toNewsItem(post: PostView): NewsItemView {
  return {
    id: post.id,
    title: post.title,
    href: `/blog/${post.slug}`,
    imageSrc: post.coverImage || undefined,
    excerpt: post.excerpt,
    source: toNewsSource(post.source),
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

/* -------------------------------------------------------------------------- */
/*                              Admin panel views                             */
/* -------------------------------------------------------------------------- */

export interface AdminServiceView extends ServiceView {
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminPostView extends PostView {
  source: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserView {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}

export interface AdminStats {
  services: number;
  publishedServices: number;
  posts: number;
  publishedPosts: number;
  users: number;
  admins: number;
}

export async function getAllServices(): Promise<AdminServiceView[]> {
  if (!prisma) return [];

  try {
    const services = await prisma.service.findMany({ orderBy: { createdAt: "desc" } });
    return services.map((service) => ({
      ...toServiceView(service),
      isPublished: service.isPublished,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));
  } catch (error) {
    console.error("Failed to load services from the database:", error);
    return [];
  }
}

export async function getAllPosts(): Promise<AdminPostView[]> {
  if (!prisma) return [];

  try {
    const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" } });
    return posts.map((post) => ({
      ...toPostView(post),
      source: post.source,
      isPublished: post.isPublished,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
  } catch (error) {
    console.error("Failed to load posts from the database:", error);
    return [];
  }
}

export async function getAllUsers(): Promise<AdminUserView[]> {
  if (!prisma) return [];

  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }));
  } catch (error) {
    console.error("Failed to load users from the database:", error);
    return [];
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const empty: AdminStats = {
    services: 0,
    publishedServices: 0,
    posts: 0,
    publishedPosts: 0,
    users: 0,
    admins: 0,
  };
  if (!prisma) return empty;

  try {
    const [services, publishedServices, posts, publishedPosts, users, admins] = await Promise.all([
      prisma.service.count(),
      prisma.service.count({ where: { isPublished: true } }),
      prisma.post.count(),
      prisma.post.count({ where: { isPublished: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
    ]);
    return { services, publishedServices, posts, publishedPosts, users, admins };
  } catch (error) {
    console.error("Failed to load admin stats from the database:", error);
    return empty;
  }
}
