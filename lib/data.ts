import type { PostModel, ServiceModel } from "@/lib/generated/prisma/models";

import { parseJsonArray } from "@/lib/db-helpers";
import { postCover, serviceCover } from "@/lib/content-placeholders";
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
  createdAt: Date;
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
  publishedAt?: string | null;
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
    coverImage: serviceCover(service.coverImage),
  };
}

function toPostView(post: PostModel): PostView {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: postCover(post.coverImage),
    images: post.images ?? null,
    readTime: post.readTime,
    source: post.source,
    sourceUrl: post.sourceUrl ?? null,
      isFeatured: post.isFeatured ?? false,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
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
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
  };
}

export interface PublicServiceItem {
  id: string;
  name: string;
  title: string;
  slug: string;
  description: string | null;
  shortDesc: string;
  /** Base price in rubles for UI display (e.g. 15000). */
  basePrice: number;
  /** Exact base price in kopecks (e.g. 1500000). */
  basePriceKopecks: number;
  priceType: string;
  currency: string;
  category: string;
  coverImage: string;
  isActive: boolean;
  isOrderable: boolean;
}

export function toPublicServiceItem(
  service: Pick<
    ServiceModel,
    | "id"
    | "title"
    | "slug"
    | "shortDesc"
    | "basePrice"
    | "priceType"
    | "currency"
    | "category"
    | "coverImage"
    | "isActive"
    | "isOrderable"
  >
): PublicServiceItem {
  return {
    id: service.id,
    name: service.title,
    title: service.title,
    slug: service.slug,
    description: service.shortDesc || null,
    shortDesc: service.shortDesc,
    basePrice: Math.round((service.basePrice ?? 0) / 100),
    basePriceKopecks: service.basePrice ?? 0,
    priceType: service.priceType ?? "quote",
    currency: service.currency ?? "RUB",
    category: service.category === "large" ? "large" : "small",
    coverImage: serviceCover(service.coverImage),
    isActive: Boolean(service.isActive),
    isOrderable: Boolean(service.isOrderable),
  };
}

export async function getActiveServices(): Promise<PublicServiceItem[]> {
  if (!prisma) return [];

  try {
    const services = await prisma.service.findMany({
      where: { isActive: true, isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return services.map(toPublicServiceItem);
  } catch (error) {
    console.error("Failed to load active services from the database:", error);
    return [];
  }
}

export async function getPublishedServices(): Promise<ServiceView[]> {
  if (!prisma) return [];

  try {
    const services = await prisma.service.findMany({
      where: { isPublished: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return services.map(toServiceView);
  } catch (error) {
    console.error("Failed to load services from the database:", error);
    return [];
  }
}

const SERVICE_SLUG_ALIASES: Record<string, string[]> = {
  "large-billboard": ["large-billboard", "large-billboard-building"],
  "large-billboard-building": ["large-billboard-building", "large-billboard"],
  "advertisement-on-the-fence": ["advertisement-on-the-fence", "advertisement-fence"],
  "advertisement-fence": ["advertisement-fence", "advertisement-on-the-fence"],
};

function candidateSlugs(slugOrId: string): string[] {
  return SERVICE_SLUG_ALIASES[slugOrId] ?? [slugOrId];
}

/**
 * `/shop/[slug]` accepts the service slug (canonical) or, for links created before
 * slugs existed, the service id.
 */
export async function getPublishedService(slugOrId: string): Promise<ServiceView | null> {
  if (!prisma) return null;

  try {
    const slugs = candidateSlugs(slugOrId);
    const service = await prisma.service.findFirst({
      where: {
        isPublished: true,
        isActive: true,
        OR: [{ slug: { in: slugs } }, { id: slugOrId }],
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

export interface ServiceOptionView {
  id: string;
  label: string;
  /** Копейки, прибавляемые к базовой цене. Может быть отрицательной. */
  priceDelta: number;
  priceFactor: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface ServiceOptionGroupView {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: ServiceOptionView[];
}

/**
 * Всё, что нужно конфигуратору на странице услуги.
 *
 * Загружается отдельным запросом, а не расширением ServiceView: список услуг
 * в /shop и карточки не должны тащить за собой дерево опций каждой позиции.
 */
export interface ServicePricingView {
  serviceId: string;
  title: string;
  /** Копейки. */
  basePrice: number;
  /** "fixed" | "from" | "quote" */
  priceType: string;
  currency: string;
  isOrderable: boolean;
  groups: ServiceOptionGroupView[];
}

/**
 * Цена и опции услуги для конфигуратора. Возвращает null, если услуги нет,
 * она снята с публикации или не продаётся — во всех трёх случаях
 * конфигуратор показывать нечего.
 */
export async function getServicePricing(slugOrId: string): Promise<ServicePricingView | null> {
  if (!prisma) return null;

  try {
    const slugs = candidateSlugs(slugOrId);
    const service = await prisma.service.findFirst({
      where: {
        isPublished: true,
        isActive: true,
        OR: [{ slug: { in: slugs } }, { id: slugOrId }],
      },
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    if (!service) return null;

    return {
      serviceId: service.id,
      title: service.title,
      basePrice: service.basePrice,
      priceType: service.priceType,
      currency: service.currency,
      isOrderable: service.isOrderable,
      groups: service.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        required: group.required,
        sortOrder: group.sortOrder,
        options: group.options.map((option) => ({
          id: option.id,
          label: option.label,
          priceDelta: option.priceDelta,
          priceFactor: option.priceFactor,
          isDefault: option.isDefault,
          sortOrder: option.sortOrder,
        })),
      })),
    };
  } catch (error) {
    console.error("Failed to load service pricing from the database:", error);
    return null;
  }
}

export async function getPublishedPosts(limit?: number): Promise<PostView[]> {
  if (!prisma) return [];

  try {
    const now = new Date();
    const take = limit === undefined ? undefined : Math.max(1, Math.floor(limit));
    const posts = await prisma.post.findMany({
      where: {
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      ...(take === undefined ? {} : { take }),
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
      where: {
        slug,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
    });
    return post ? toPostView(post) : null;
  } catch (error) {
    console.error("Failed to load the post from the database:", error);
    return null;
  }
}

export interface FeaturedPostView {
  title: string;
  slug: string;
  coverImage: string;
}

const featuredPostSelect = { title: true, slug: true, coverImage: true } as const;

/** Навигации нужны только поля ссылки и обложки, не HTML всей featured-статьи. */
export async function getFeaturedPost(): Promise<FeaturedPostView | null> {
  if (!prisma) return null;

  try {
    let post = await prisma.post.findFirst({
      where: { isPublished: true, isFeatured: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: featuredPostSelect,
    });
    if (!post) {
      post = await prisma.post.findFirst({
        where: { isPublished: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        select: featuredPostSelect,
      });
    }
    return post ? { ...post, coverImage: postCover(post.coverImage) } : null;
  } catch (error) {
    console.error("Failed to load featured post from the database:", error);
    return null;
  }
}
