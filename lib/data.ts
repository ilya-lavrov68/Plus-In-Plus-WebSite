import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";

import type { CommerceServiceOptionGroup } from "@/lib/commerce";
import { rows, sqlValue } from "@/lib/db";
import { parseJsonArray } from "@/lib/db-helpers";
import { postCover, serviceCover } from "@/lib/content-placeholders";

/**
 * Публичные чтения сайта. Запросы идут напрямую в SQLite (`lib.db`), без CMS:
 * услуги, их опции и материалы — обычные таблицы, а массивные поля
 * (`services_includes`, `services_shapes`, `services_option_groups`,
 * `posts_rels`) подтягиваются отдельными запросами по выбранным id.
 */

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

type ServiceRow = Record<string, unknown>;
type PostRow = Record<string, unknown>;

function arrayValues(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "object" && item !== null && "value" in item ? (item as { value: unknown }).value : item)).filter((item) => typeof item === "string")
    : value;
}

/** Совместимость с местами, где документ приходит уже собранным (корзина). */
export function normalizeService(service: {
  id: string; title: string; slug: string; category: string; shortDesc: string; fullDesc: string;
  includes?: unknown; shapes?: unknown; resultText: string; coverImage?: string | null;
  cover?: { url?: string | null } | string | number | null; isPublished?: boolean | null; sortOrder?: number | null;
  basePrice?: number | null; priceType?: string | null; currency?: string | null; isOrderable?: boolean | null;
  isActive?: boolean | null;
  optionGroups?: Array<{ id?: string | null; name: string; required?: boolean | null; sortOrder?: number | null; options?: Array<{ id?: string | null; label: string; priceDelta?: number | null; priceFactor?: number | null; isDefault?: boolean | null; sortOrder?: number | null }> | null }> | null;
  createdAt?: string | Date | null; updatedAt?: string | Date | null;
}): ServiceModel {
  const includes = service.includes;
  const shapes = service.shapes;
  const optionGroups: CommerceServiceOptionGroup[] = (service.optionGroups ?? []).flatMap((group) => {
    if (!group.id) return [];
    const options = (group.options ?? []).flatMap((option) =>
      option.id
        ? [{
            id: option.id,
            label: option.label,
            priceDelta: option.priceDelta ?? 0,
            priceFactor: option.priceFactor ?? 1,
            isDefault: option.isDefault === true,
            sortOrder: option.sortOrder ?? 0,
          }]
        : [],
    );
    return [{ id: group.id, name: group.name, required: group.required === true, sortOrder: group.sortOrder ?? 0, options }];
  });
  return {
    id: service.id,
    title: service.title,
    slug: service.slug,
    category: service.category,
    shortDesc: service.shortDesc,
    fullDesc: service.fullDesc,
    includes: typeof includes === "string" ? includes : JSON.stringify(arrayValues(includes) ?? []),
    shapes: typeof shapes === "string" ? shapes : JSON.stringify(arrayValues(shapes) ?? []),
    resultText: service.resultText,
    coverImage: service.coverImage ?? (typeof service.cover === "object" ? service.cover?.url : null) ?? "",
    isPublished: service.isPublished === true,
    sortOrder: service.sortOrder ?? 0,
    basePrice: service.basePrice ?? 0,
    priceType: service.priceType ?? "quote",
    currency: service.currency ?? "RUB",
    isOrderable: service.isOrderable === true,
    isActive: service.isActive === true,
    optionGroups,
    createdAt: sqlValue.date(service.createdAt) ?? new Date(0),
    updatedAt: sqlValue.date(service.updatedAt) ?? new Date(0),
  };
}

function serviceFromRow(row: ServiceRow, relations: {
  includes: Map<string, string[]>;
  shapes: Map<string, string[]>;
  groups: CommerceServiceOptionGroup[];
}): ServiceModel {
  const id = sqlValue.text(row.id);
  return {
    id,
    title: sqlValue.text(row.title),
    slug: sqlValue.text(row.slug),
    category: sqlValue.text(row.category),
    shortDesc: sqlValue.text(row.short_desc),
    fullDesc: sqlValue.text(row.full_desc),
    includes: JSON.stringify(relations.includes.get(id) ?? []),
    shapes: JSON.stringify(relations.shapes.get(id) ?? []),
    resultText: sqlValue.text(row.result_text),
    coverImage: sqlValue.text(row.cover_url) || sqlValue.text(row.cover_image),
    isPublished: sqlValue.boolean(row.is_published),
    sortOrder: sqlValue.number(row.sort_order),
    basePrice: sqlValue.number(row.base_price),
    priceType: sqlValue.text(row.price_type) || "quote",
    currency: sqlValue.text(row.currency) || "RUB",
    isOrderable: sqlValue.boolean(row.is_orderable),
    isActive: sqlValue.boolean(row.is_active),
    optionGroups: relations.groups,
    createdAt: sqlValue.date(row.created_at) ?? new Date(0),
    updatedAt: sqlValue.date(row.updated_at) ?? new Date(0),
  };
}

const SERVICE_COLUMNS = `s.id, s.title, s.slug, s.category, s.short_desc, s.full_desc, s.result_text,
  s.cover_image, s.base_price, s.price_type, s.currency, s.is_orderable, s.is_published, s.is_active,
  s.sort_order, s.created_at, s.updated_at, m.url cover_url`;

function groupValues(list: Array<{ parent: string; value: string }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of list) {
    const bucket = map.get(item.parent);
    if (bucket) bucket.push(item.value);
    else map.set(item.parent, [item.value]);
  }
  return map;
}

async function serviceRelations(serviceIds: string[], withOptions: boolean) {
  if (serviceIds.length === 0) return { includes: new Map(), shapes: new Map(), groupsByService: new Map<string, CommerceServiceOptionGroup[]>() };
  const placeholders = serviceIds.map(() => "?").join(", ");
  const [includeRows, shapeRows] = await Promise.all([
    rows<{ parent: string; value: string }>(
      `select _parent_id parent, value from services_includes where _parent_id in (${placeholders}) order by _order asc`,
      serviceIds,
    ),
    rows<{ parent: string; value: string }>(
      `select _parent_id parent, value from services_shapes where _parent_id in (${placeholders}) order by _order asc`,
      serviceIds,
    ),
  ]);

  const groupsByService = new Map<string, CommerceServiceOptionGroup[]>();
  if (withOptions) {
    const groups = await rows<Record<string, unknown>>(
      `select id, _parent_id parent, name, required, sort_order from services_option_groups
       where _parent_id in (${placeholders}) order by sort_order asc, _order asc`,
      serviceIds,
    );
    const groupIds = groups.map((group) => sqlValue.text(group.id));
    const options = groupIds.length
      ? await rows<Record<string, unknown>>(
          `select id, _parent_id parent, label, price_delta, price_factor, is_default, sort_order
           from services_option_groups_options where _parent_id in (${groupIds.map(() => "?").join(", ")})
           order by sort_order asc, _order asc`,
          groupIds,
        )
      : [];
    const optionsByGroup = new Map<string, CommerceServiceOptionGroup["options"]>();
    for (const option of options) {
      const parent = sqlValue.text(option.parent);
      const bucket = optionsByGroup.get(parent) ?? [];
      bucket.push({
        id: sqlValue.text(option.id),
        label: sqlValue.text(option.label),
        priceDelta: sqlValue.number(option.price_delta),
        priceFactor: sqlValue.number(option.price_factor),
        isDefault: sqlValue.boolean(option.is_default),
        sortOrder: sqlValue.number(option.sort_order),
      });
      optionsByGroup.set(parent, bucket);
    }
    for (const group of groups) {
      const parent = sqlValue.text(group.parent);
      const bucket = groupsByService.get(parent) ?? [];
      bucket.push({
        id: sqlValue.text(group.id),
        name: sqlValue.text(group.name),
        required: sqlValue.boolean(group.required),
        sortOrder: sqlValue.number(group.sort_order),
        options: optionsByGroup.get(sqlValue.text(group.id)) ?? [],
      });
      groupsByService.set(parent, bucket);
    }
  }

  return {
    includes: groupValues(includeRows),
    shapes: groupValues(shapeRows),
    groupsByService,
  };
}

async function loadServices(options: {
  where: string[];
  args: unknown[];
  orderBy: string;
  limit?: number;
  withOptions?: boolean;
}): Promise<ServiceModel[]> {
  const whereSql = options.where.length ? `where ${options.where.join(" and ")}` : "";
  const limitSql = options.limit === undefined ? "" : "limit ?";
  const args = options.limit === undefined ? options.args : [...options.args, options.limit];
  const serviceRows = await rows<ServiceRow>(
    `select ${SERVICE_COLUMNS} from services s left join media m on m.id = s.cover_id
     ${whereSql} order by ${options.orderBy} ${limitSql}`,
    args,
  );
  if (serviceRows.length === 0) return [];
  const relations = await serviceRelations(serviceRows.map((row) => sqlValue.text(row.id)), options.withOptions === true);
  return serviceRows.map((row) => serviceFromRow(row, {
    includes: relations.includes,
    shapes: relations.shapes,
    groups: relations.groupsByService.get(sqlValue.text(row.id)) ?? [],
  }));
}

const PUBLISHED_POST_SQL = "(p.is_published = 1 and (p.published_at is null or p.published_at = '' or p.published_at <= ?))";

function postContent(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return value;
  try {
    const parsed = JSON.parse(trimmed) as { root?: unknown };
    if (parsed && typeof parsed === "object" && parsed.root) {
      return convertLexicalToHTML({ data: parsed as never });
    }
  } catch {
    // Не JSON — обычный текст или HTML.
  }
  return value;
}

function postFromRow(row: PostRow, gallery: Map<string, string[]>): PostModel {
  const id = sqlValue.text(row.id);
  return {
    id,
    title: sqlValue.text(row.title),
    slug: sqlValue.text(row.slug),
    excerpt: sqlValue.text(row.excerpt),
    content: postContent(row.content),
    coverImage: sqlValue.text(row.cover_url) || sqlValue.text(row.cover_image),
    images: gallery.has(id) ? JSON.stringify(gallery.get(id)) : null,
    readTime: sqlValue.number(row.read_time) || 5,
    source: sqlValue.text(row.source) || "manual",
    sourceUrl: row.source_url == null ? null : sqlValue.text(row.source_url),
    isFeatured: sqlValue.boolean(row.is_featured),
    isPublished: sqlValue.boolean(row.is_published),
    publishedAt: sqlValue.date(row.published_at),
    createdAt: sqlValue.date(row.created_at) ?? new Date(0),
    updatedAt: sqlValue.date(row.updated_at) ?? new Date(0),
  };
}

const POST_COLUMNS = `p.id, p.title, p.slug, p.excerpt, p.content, p.cover_image, p.read_time, p.source,
  p.source_url, p.is_featured, p.is_published, p.published_at, p.created_at, p.updated_at, m.url cover_url`;

async function loadPosts(options: { where: string[]; args: unknown[]; limit?: number }): Promise<PostModel[]> {
  const whereSql = options.where.length ? `where ${options.where.join(" and ")}` : "";
  const limitSql = options.limit === undefined ? "" : "limit ?";
  const args = options.limit === undefined ? options.args : [...options.args, options.limit];
  const postRows = await rows<PostRow>(
    `select ${POST_COLUMNS} from posts p left join media m on m.id = p.cover_id
     ${whereSql} order by coalesce(p.published_at, p.created_at) desc, p.created_at desc ${limitSql}`,
    args,
  );
  if (postRows.length === 0) return [];
  const galleryRows = await rows<{ parent: string; url: string }>(
    `select r.parent_id parent, m.url from posts_rels r join media m on m.id = r.media_id
     where r.parent_id in (${postRows.map(() => "?").join(", ")}) order by r."order" asc`,
    postRows.map((row) => sqlValue.text(row.id)),
  );
  const gallery = new Map<string, string[]>();
  for (const item of galleryRows) {
    if (!item.url) continue;
    const bucket = gallery.get(item.parent) ?? [];
    bucket.push(item.url);
    gallery.set(item.parent, bucket);
  }
  return postRows.map((row) => postFromRow(row, gallery));
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

export async function getActiveServices(): Promise<PublicServiceItem[]> {
  try {
    const services = await loadServices({
      where: ["s.is_active = 1", "s.is_published = 1"],
      args: [],
      orderBy: "s.sort_order asc, s.title asc",
    });
    return services.map(toPublicServiceItem);
  } catch (error) {
    console.error("Failed to load active services:", error);
    return [];
  }
}

export async function getPublishedServices(): Promise<ServiceView[]> {
  try {
    const services = await loadServices({
      where: ["s.is_published = 1", "s.is_active = 1"],
      args: [],
      orderBy: "s.created_at asc",
    });
    return services.map(toServiceView);
  } catch (error) {
    console.error("Failed to load services:", error);
    return [];
  }
}

export async function getSitemapServices(): Promise<Array<Pick<ServiceView, "id" | "slug">>> {
  try {
    const services = await loadServices({
      where: ["s.is_published = 1", "s.is_active = 1"],
      args: [],
      orderBy: "s.created_at asc",
    });
    return services.map(({ id, slug }) => ({ id, slug }));
  } catch (error) {
    console.error("Failed to load sitemap services:", error);
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

async function findServiceBySlug(slugOrId: string, withOptions: boolean): Promise<ServiceModel | null> {
  const slugs = candidateSlugs(slugOrId);
  const services = await loadServices({
    where: [
      "s.is_published = 1",
      "s.is_active = 1",
      `(s.slug in (${slugs.map(() => "?").join(", ")}) or s.id = ?)`,
    ],
    args: [...slugs, slugOrId],
    orderBy: "s.created_at asc",
    limit: 1,
    withOptions,
  });
  return services[0] ?? null;
}

export async function getPublishedService(slugOrId: string): Promise<ServiceView | null> {
  try {
    const service = await findServiceBySlug(slugOrId, false);
    return service ? toServiceView(service) : null;
  } catch (error) {
    console.error("Failed to load the service:", error);
    return null;
  }
}

export function serviceHref(service: Pick<ServiceView, "id" | "slug">): string {
  return `/shop/${encodeURIComponent(service.slug || service.id)}`;
}

export interface ServiceOptionView { id: string; label: string; priceDelta: number; priceFactor: number; isDefault: boolean; sortOrder: number }
export interface ServiceOptionGroupView { id: string; name: string; required: boolean; sortOrder: number; options: ServiceOptionView[] }
export interface ServicePricingView { serviceId: string; title: string; basePrice: number; priceType: string; currency: string; isOrderable: boolean; groups: ServiceOptionGroupView[] }

export async function getServicePricing(slugOrId: string): Promise<ServicePricingView | null> {
  try {
    const service = await findServiceBySlug(slugOrId, true);
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
            .map((option) => ({
              id: option.id, label: option.label, priceDelta: option.priceDelta,
              priceFactor: option.priceFactor, isDefault: Boolean(option.isDefault), sortOrder: option.sortOrder,
            })),
        })),
    };
  } catch (error) {
    console.error("Failed to load service pricing:", error);
    return null;
  }
}

function publishedPostFilter(): { where: string[]; args: unknown[] } {
  const now = new Date().toISOString();
  return { where: [PUBLISHED_POST_SQL], args: [now] };
}

export async function getPublishedPosts(limit?: number): Promise<PostView[]> {
  try {
    const take = limit === undefined ? undefined : Math.max(1, Math.floor(limit));
    const filter = publishedPostFilter();
    const posts = await loadPosts({ where: filter.where, args: filter.args, limit: take });
    return posts.map(toPostView);
  } catch (error) {
    console.error("Failed to load posts:", error);
    return [];
  }
}

export async function getSitemapPosts(): Promise<Array<Pick<PostView, "slug" | "publishedAt">>> {
  try {
    const filter = publishedPostFilter();
    const posts = await loadPosts({ where: filter.where, args: filter.args });
    return posts.map(({ slug, publishedAt }) => ({ slug, publishedAt }));
  } catch (error) {
    console.error("Failed to load sitemap posts:", error);
    return [];
  }
}

export async function getPublishedPost(slug: string): Promise<PostView | null> {
  try {
    const filter = publishedPostFilter();
    const posts = await loadPosts({ where: ["p.slug = ?", ...filter.where], args: [slug, ...filter.args], limit: 1 });
    return posts[0] ? toPostView(posts[0]) : null;
  } catch (error) {
    console.error("Failed to load the post:", error);
    return null;
  }
}

export interface FeaturedPostView { title: string; slug: string; coverImage: string }

export async function getFeaturedPost(): Promise<FeaturedPostView | null> {
  try {
    const filter = publishedPostFilter();
    let posts = await loadPosts({ where: ["p.is_featured = 1", ...filter.where], args: filter.args, limit: 1 });
    if (!posts.length) posts = await loadPosts({ where: filter.where, args: filter.args, limit: 1 });
    const post = posts[0];
    return post ? { title: post.title, slug: post.slug, coverImage: postCover(post.coverImage) } : null;
  } catch (error) {
    console.error("Failed to load featured post:", error);
    return null;
  }
}
