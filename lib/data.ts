import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { SelectType, Where } from "payload";

import type { CommerceServiceOptionGroup } from "@/lib/commerce";
import { parseJsonArray } from "@/lib/db-helpers";
import { postCover, serviceCover } from "@/lib/content-placeholders";
import { getPayloadClient, payloadDate } from "@/lib/payload-native";
import type { Post, Service } from "@/payload/payload-types";

export interface ServiceModel {
  id: string; title: string; slug: string; category: string; shortDesc: string; fullDesc: string;
  includes: string; shapes: string; resultText: string; coverImage: string; isPublished: boolean;
  sortOrder: number; basePrice: number; priceType: string; currency: string; isOrderable: boolean;
  isActive: boolean; optionGroups: CommerceServiceOptionGroup[]; createdAt: Date; updatedAt: Date;
}
export interface PostModel {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string;
  images: string | null; readTime: number; source: string; sourceUrl: string | null; isFeatured: boolean;
  isPublished: boolean; publishedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface ServiceView {
  id: string; title: string; slug: string; category: string; shortDesc: string; fullDesc: string;
  includes: string[]; shapes: string[]; resultText: string; coverImage: string;
}
export interface PostView {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string;
  images?: string | null; readTime: number; source: string; sourceUrl?: string | null;
  isFeatured?: boolean; publishedAt: Date | null; createdAt: Date;
}
export type NewsSource = "vk" | "telegram" | "youtube" | "manual";
export interface NewsItemView {
  id: string; title: string; href: string; postUrl?: string; sourceUrl?: string | null;
  imageSrc?: string; excerpt: string; source: NewsSource; description?: string;
  imagesCount?: number; publishedAt?: string | null;
}

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>;
function arrayValues(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "object" && item !== null && "value" in item ? (item as { value: unknown }).value : item).filter((item) => typeof item === "string")
    : value;
}
export function normalizeService(service: Service): ServiceModel {
  const includes: unknown = service.includes;
  const shapes: unknown = service.shapes;
  const optionGroups: CommerceServiceOptionGroup[] = (service.optionGroups ?? []).flatMap((group) => {
    if (!group.id) return [];
    const options = (group.options ?? []).flatMap((option) => option.id ? [{
      id: option.id,
      label: option.label,
      priceDelta: option.priceDelta,
      priceFactor: option.priceFactor,
      isDefault: option.isDefault === true,
      sortOrder: option.sortOrder,
    }] : []);
    return [{ id: group.id, name: group.name, required: group.required === true, sortOrder: group.sortOrder, options }];
  });
  return {
    ...service,
    coverImage: service.coverImage ?? (typeof service.cover === "object" ? service.cover?.url : null) ?? "",
    includes: typeof includes === "string" ? includes : JSON.stringify(arrayValues(includes) ?? []),
    shapes: typeof shapes === "string" ? shapes : JSON.stringify(arrayValues(shapes) ?? []),
    isActive: service.isActive === true,
    isPublished: service.isPublished === true,
    isOrderable: service.isOrderable === true,
    optionGroups,
    createdAt: payloadDate(service.createdAt) ?? new Date(0),
    updatedAt: payloadDate(service.updatedAt) ?? new Date(0),
  };
}
function normalizePost(post: Post): PostModel {
  const gallery = Array.isArray(post.gallery)
    ? post.gallery.map((media) => typeof media === "object" ? media.url : null).filter((url): url is string => typeof url === "string" && url.length > 0)
    : null;
  return {
    ...post,
    content: post.content && typeof post.content === "object" && post.content.root
      ? convertLexicalToHTML({ data: post.content })
      : String(post.content ?? ""),
    coverImage: post.coverImage ?? (typeof post.cover === "object" ? post.cover?.url : null) ?? "",
    images: typeof post.images === "string" ? post.images : gallery ? JSON.stringify(gallery) : null,
    publishedAt: payloadDate(post.publishedAt),
    createdAt: payloadDate(post.createdAt) ?? new Date(0),
    updatedAt: payloadDate(post.updatedAt) ?? new Date(0),
  } as PostModel;
}
function toServiceView(service: ServiceModel): ServiceView {
  return {
    id: service.id, title: service.title, slug: service.slug, category: service.category,
    shortDesc: service.shortDesc, fullDesc: service.fullDesc, includes: parseJsonArray(service.includes),
    shapes: parseJsonArray(service.shapes), resultText: service.resultText, coverImage: serviceCover(service.coverImage),
  };
}
function toPostView(post: PostModel): PostView {
  return {
    id: post.id, title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content,
    coverImage: postCover(post.coverImage), images: post.images ?? null, readTime: post.readTime,
    source: post.source, sourceUrl: post.sourceUrl ?? null, isFeatured: post.isFeatured ?? false,
    publishedAt: post.publishedAt, createdAt: post.createdAt,
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
    id: post.id, title: post.title, href: `/blog/${post.slug}`, postUrl: `/blog/${post.slug}`,
    sourceUrl: post.sourceUrl ?? null, imageSrc: post.coverImage || undefined, excerpt: post.excerpt,
    source: toNewsSource(post.source), description: post.excerpt || undefined,
    imagesCount: additionalImages.length, publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
  };
}
export interface PublicServiceItem {
  id: string; name: string; title: string; slug: string; description: string | null; shortDesc: string;
  basePrice: number; basePriceKopecks: number; priceType: string; currency: string; category: string;
  coverImage: string; isActive: boolean; isOrderable: boolean;
}
export function toPublicServiceItem(service: Pick<ServiceModel, "id" | "title" | "slug" | "shortDesc" | "basePrice" | "priceType" | "currency" | "category" | "coverImage" | "isActive" | "isOrderable">): PublicServiceItem {
  return {
    id: service.id, name: service.title, title: service.title, slug: service.slug,
    description: service.shortDesc || null, shortDesc: service.shortDesc,
    basePrice: Math.round((service.basePrice ?? 0) / 100), basePriceKopecks: service.basePrice ?? 0,
    priceType: service.priceType ?? "quote", currency: service.currency ?? "RUB",
    category: service.category === "large" ? "large" : "small", coverImage: serviceCover(service.coverImage),
    isActive: Boolean(service.isActive), isOrderable: Boolean(service.isOrderable),
  };
}

async function findServices(
  payload: PayloadClient,
  where: Where,
  sort: string | string[],
  depth = 1,
  select?: SelectType,
) {
  const result = await payload.find({
    collection: "services",
    depth,
    pagination: false,
    sort,
    overrideAccess: true,
    ...(select ? { select } : {}),
    where,
  });
  return (result.docs as Service[]).map(normalizeService);
}
async function findPosts(
  payload: PayloadClient,
  where: Where,
  sort: string | string[],
  limit?: number,
  select?: SelectType,
  depth = 1,
) {
  const result = await payload.find({
    collection: "posts",
    depth,
    pagination: limit === undefined ? false : true,
    ...(limit === undefined ? {} : { limit }),
    ...(select ? { select } : {}),
    sort,
    overrideAccess: true,
    where,
  });
  return (result.docs as Post[]).map(normalizePost);
}
const publishedPostClauses = (): Where[] => [
  { isPublished: { equals: true } },
  { or: [{ publishedAt: { exists: false } }, { publishedAt: { less_than_equal: new Date().toISOString() } }] },
];
const publishedPostWhere = (): Where => ({ and: publishedPostClauses() });

export async function getActiveServices(): Promise<PublicServiceItem[]> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isActive: { equals: true } }, { isPublished: { equals: true } }] }, ["sortOrder", "title"], 1, { title: true, slug: true, shortDesc: true, basePrice: true, priceType: true, currency: true, category: true, coverImage: true, cover: true, isActive: true, isOrderable: true })).map(toPublicServiceItem);
  } catch (error) { console.error("Failed to load active services from Payload:", error); return []; }
}
export async function getPublishedServices(): Promise<ServiceView[]> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isPublished: { equals: true } }, { isActive: { equals: true } }] }, "createdAt", 1, { title: true, slug: true, category: true, shortDesc: true, fullDesc: true, includes: true, shapes: true, resultText: true, coverImage: true, cover: true })).map(toServiceView);
  } catch (error) { console.error("Failed to load services from Payload:", error); return []; }
}
export async function getSitemapServices(): Promise<Array<Pick<ServiceView, "id" | "slug">>> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isPublished: { equals: true } }, { isActive: { equals: true } }] }, "createdAt", 0, { slug: true })).map(({ id, slug }) => ({ id, slug }));
  } catch (error) { console.error("Failed to load sitemap services from Payload:", error); return []; }
}
const SERVICE_SLUG_ALIASES: Record<string, string[]> = {
  "large-billboard": ["large-billboard", "large-billboard-building"],
  "large-billboard-building": ["large-billboard-building", "large-billboard"],
  "advertisement-on-the-fence": ["advertisement-on-the-fence", "advertisement-fence"],
  "advertisement-fence": ["advertisement-fence", "advertisement-on-the-fence"],
};
function candidateSlugs(slugOrId: string): string[] { return SERVICE_SLUG_ALIASES[slugOrId] ?? [slugOrId]; }
async function findServiceBySlug(payload: PayloadClient, slugOrId: string, depth = 1) {
  const result = await payload.find({
    collection: "services", depth, limit: 1, overrideAccess: true,
    where: { and: [{ isPublished: { equals: true } }, { isActive: { equals: true } }, { or: [{ slug: { in: candidateSlugs(slugOrId) } }, { id: { equals: slugOrId } }] }] },
  });
  return result.docs[0] ? normalizeService(result.docs[0]) : null;
}
export async function getPublishedService(slugOrId: string): Promise<ServiceView | null> {
  try { const payload = await getPayloadClient(); const service = await findServiceBySlug(payload, slugOrId); return service ? toServiceView(service) : null; }
  catch (error) { console.error("Failed to load the service from Payload:", error); return null; }
}
export function serviceHref(service: Pick<ServiceView, "id" | "slug">): string { return `/shop/${encodeURIComponent(service.slug || service.id)}`; }
export interface ServiceOptionView { id: string; label: string; priceDelta: number; priceFactor: number; isDefault: boolean; sortOrder: number }
export interface ServiceOptionGroupView { id: string; name: string; required: boolean; sortOrder: number; options: ServiceOptionView[] }
export interface ServicePricingView { serviceId: string; title: string; basePrice: number; priceType: string; currency: string; isOrderable: boolean; groups: ServiceOptionGroupView[] }
export async function getServicePricing(slugOrId: string): Promise<ServicePricingView | null> {
  try {
    const payload = await getPayloadClient();
    const service = await findServiceBySlug(payload, slugOrId, 2);
    if (!service) return null;
    return {
      serviceId: service.id, title: service.title, basePrice: service.basePrice, priceType: service.priceType,
      currency: service.currency, isOrderable: service.isOrderable,
      groups: [...service.optionGroups]
        .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
        .map((group) => ({
          id: group.id, name: group.name, required: Boolean(group.required), sortOrder: group.sortOrder,
          options: [...(group.options ?? [])]
            .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
            .map((option) => ({ id: option.id, label: option.label, priceDelta: option.priceDelta, priceFactor: option.priceFactor, isDefault: Boolean(option.isDefault), sortOrder: option.sortOrder })),
        })),
    };
  } catch (error) { console.error("Failed to load service pricing from Payload:", error); return null; }
}
export async function getPublishedPosts(limit?: number): Promise<PostView[]> {
  try { const payload = await getPayloadClient(); const take = limit === undefined ? undefined : Math.max(1, Math.floor(limit)); return (await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"], take)).map(toPostView); }
  catch (error) { console.error("Failed to load posts from Payload:", error); return []; }
}
export async function getSitemapPosts(): Promise<Array<Pick<PostView, "slug" | "publishedAt">>> {
  try { const payload = await getPayloadClient(); return (await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"], undefined, { slug: true, publishedAt: true }, 0)).map(({ slug, publishedAt }) => ({ slug, publishedAt })); }
  catch (error) { console.error("Failed to load sitemap posts from Payload:", error); return []; }
}
export async function getPublishedPost(slug: string): Promise<PostView | null> {
  try {
    const payload = await getPayloadClient();
    const posts = await findPosts(payload, { and: [{ slug: { equals: slug } }, ...publishedPostClauses()] }, ["-publishedAt", "-createdAt"], 1);
    return posts[0] ? toPostView(posts[0]) : null;
  } catch (error) { console.error("Failed to load the post from Payload:", error); return null; }
}
export interface FeaturedPostView { title: string; slug: string; coverImage: string }
export async function getFeaturedPost(): Promise<FeaturedPostView | null> {
  try {
    const payload = await getPayloadClient();
    const select = { title: true, slug: true, coverImage: true, cover: true } as const;
    let posts = await findPosts(payload, { and: [{ isFeatured: { equals: true } }, ...publishedPostClauses()] }, ["-publishedAt", "-createdAt"], 1, select);
    if (!posts.length) posts = await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"], 1, select);
    const post = posts[0];
    return post ? { title: post.title, slug: post.slug, coverImage: postCover(post.coverImage) } : null;
  } catch (error) { console.error("Failed to load featured post from Payload:", error); return null; }
}
