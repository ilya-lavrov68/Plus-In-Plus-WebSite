import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";

import { parseJsonArray } from "@/lib/db-helpers";
import { postCover, serviceCover } from "@/lib/content-placeholders";
import { getPayloadClient, payloadDate } from "@/lib/payload-native";

export interface ServiceModel {
  id: string; title: string; slug: string; category: string; shortDesc: string; fullDesc: string;
  includes: string; shapes: string; resultText: string; coverImage: string; isPublished: boolean;
  sortOrder: number; basePrice: number; priceType: string; currency: string; isOrderable: boolean;
  isActive: boolean; optionGroups: any[]; createdAt: Date; updatedAt: Date;
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
function normalizeService(service: any): ServiceModel {
  return {
    ...service,
    coverImage: service.coverImage ?? (typeof service.cover === "object" ? service.cover?.url : null) ?? "",
    includes: typeof service.includes === "string" ? service.includes : JSON.stringify(arrayValues(service.includes) ?? []),
    shapes: typeof service.shapes === "string" ? service.shapes : JSON.stringify(arrayValues(service.shapes) ?? []),
    optionGroups: service.optionGroups ?? [],
    createdAt: payloadDate(service.createdAt) ?? new Date(0),
    updatedAt: payloadDate(service.updatedAt) ?? new Date(0),
  } as ServiceModel;
}
function normalizePost(post: any): PostModel {
  const gallery = Array.isArray(post.gallery) ? post.gallery.map((media: any) => typeof media === "object" ? media.url : null).filter(Boolean) : null;
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

async function findServices(payload: PayloadClient, where: Record<string, unknown>, sort: string | string[], depth = 1) {
  const result = await payload.find({ collection: "services", depth, pagination: false, sort, overrideAccess: true, where: where as any });
  return (result.docs as any[]).map(normalizeService);
}
async function findPosts(payload: PayloadClient, where: Record<string, unknown>, sort: string | string[], limit?: number) {
  const result = await payload.find({ collection: "posts", depth: 1, pagination: limit === undefined ? false : true, ...(limit === undefined ? {} : { limit }), sort, overrideAccess: true, where: where as any });
  return (result.docs as any[]).map(normalizePost);
}
const publishedPostWhere = () => ({ and: [{ isPublished: { equals: true } }, { or: [{ publishedAt: { exists: false } }, { publishedAt: { less_than_equal: new Date().toISOString() } }] }] });

export async function getActiveServices(): Promise<PublicServiceItem[]> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isActive: { equals: true } }, { isPublished: { equals: true } }] }, ["sortOrder", "title"])).map(toPublicServiceItem);
  } catch (error) { console.error("Failed to load active services from Payload:", error); return []; }
}
export async function getPublishedServices(): Promise<ServiceView[]> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isPublished: { equals: true } }, { isActive: { equals: true } }] }, "createdAt")).map(toServiceView);
  } catch (error) { console.error("Failed to load services from Payload:", error); return []; }
}
export async function getSitemapServices(): Promise<Array<Pick<ServiceView, "id" | "slug">>> {
  try {
    const payload = await getPayloadClient();
    return (await findServices(payload, { and: [{ isPublished: { equals: true } }, { isActive: { equals: true } }] }, "createdAt", 0)).map(({ id, slug }) => ({ id, slug }));
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
            .map((option: any) => ({ id: option.id, label: option.label, priceDelta: option.priceDelta, priceFactor: option.priceFactor, isDefault: Boolean(option.isDefault), sortOrder: option.sortOrder })),
        })),
    };
  } catch (error) { console.error("Failed to load service pricing from Payload:", error); return null; }
}
export async function getPublishedPosts(limit?: number): Promise<PostView[]> {
  try { const payload = await getPayloadClient(); const take = limit === undefined ? undefined : Math.max(1, Math.floor(limit)); return (await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"], take)).map(toPostView); }
  catch (error) { console.error("Failed to load posts from Payload:", error); return []; }
}
export async function getSitemapPosts(): Promise<Array<Pick<PostView, "slug" | "publishedAt">>> {
  try { const payload = await getPayloadClient(); return (await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"])).map(({ slug, publishedAt }) => ({ slug, publishedAt })); }
  catch (error) { console.error("Failed to load sitemap posts from Payload:", error); return []; }
}
export async function getPublishedPost(slug: string): Promise<PostView | null> {
  try {
    const payload = await getPayloadClient();
    const posts = await findPosts(payload, { and: [{ slug: { equals: slug } }, ...publishedPostWhere().and] }, ["-publishedAt", "-createdAt"], 1);
    return posts[0] ? toPostView(posts[0]) : null;
  } catch (error) { console.error("Failed to load the post from Payload:", error); return null; }
}
export interface FeaturedPostView { title: string; slug: string; coverImage: string }
export async function getFeaturedPost(): Promise<FeaturedPostView | null> {
  try {
    const payload = await getPayloadClient();
    let posts = await findPosts(payload, { and: [{ isFeatured: { equals: true } }, ...publishedPostWhere().and] }, ["-publishedAt", "-createdAt"], 1);
    if (!posts.length) posts = await findPosts(payload, publishedPostWhere(), ["-publishedAt", "-createdAt"], 1);
    const post = posts[0];
    return post ? { title: post.title, slug: post.slug, coverImage: postCover(post.coverImage) } : null;
  } catch (error) { console.error("Failed to load featured post from Payload:", error); return null; }
}
