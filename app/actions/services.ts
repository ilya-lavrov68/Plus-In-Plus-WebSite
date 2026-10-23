"use server";

import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/admin-session";
import { parseLineList, toJsonArray } from "@/lib/db-helpers";
import { prisma } from "@/lib/prisma";
import { revalidateService } from "@/lib/revalidate-content";
import { slugify, withNumericSuffix } from "@/lib/slug";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { createServiceSchema, firstIssueMessage } from "@/lib/validators";
import type { MessageTranslator } from "@/lib/i18n-messages";

export interface ServiceActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseCommonFields(form: FormData, t: MessageTranslator) {
  const result = createServiceSchema.safeParse({
    title: text(form, "title"),
    slug: text(form, "slug") || undefined,
    category: text(form, "category"),
    shortDesc: text(form, "shortDesc"),
    fullDesc: text(form, "fullDesc"),
    includes: parseLineList(text(form, "includes")),
    shapes: parseLineList(text(form, "shapes")),
    resultText: text(form, "resultText"),
    isPublished: form.get("isPublished") === "true" || form.get("isPublished") === "on",
  });
  if (!result.success) return { error: t(firstIssueMessage(result.error)) };
  return { data: result.data };
}

/**
 * Slugs are unique in the database; a human title can repeat. Falls back to
 * `title-2`, `title-3`, … so saving never fails with a raw constraint error.
 */
async function resolveServiceSlug(base: string, excludeId?: string): Promise<string> {
  if (!prisma) return base;
  for (let index = 1; index < 50; index += 1) {
    const candidate = withNumericSuffix(base, index);
    const existing = await prisma.service.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
  }
  return withNumericSuffix(base, Date.now() % 1000 + 50);
}

function coverFile(form: FormData, t: MessageTranslator): File | null {
  const file = form.get("cover");
  if (typeof file === "string" && file) throw new UploadValidationError(t("uploadLocalCover"));
  if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError(t("emptyImage"));
  return file instanceof File && file.size > 0 ? file : null;
}

/** Единственный источник правды о допустимых типах цены — и в форме, и здесь. */
const PRICE_TYPES = ["fixed", "from", "quote"] as const;

/** Статусы заказов, считающихся активными (не завершён и не отменён). */
export const ACTIVE_ORDER_STATUSES = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
  "paid",
  "in_progress",
] as const;

type OrderCounterClient = {
  order?: {
    count?: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
};

/**
 * Проверяет, включена ли услуга хотя бы в один активный заказ
 * (через связующую таблицу OrderService или позиции OrderItem).
 */
async function hasActiveOrdersForService(
  db: OrderCounterClient,
  serviceId: string
): Promise<boolean> {
  if (!db.order?.count) return false;
  const activeCount = await db.order.count({
    where: {
      status: { in: [...ACTIVE_ORDER_STATUSES] },
      OR: [
        { services: { some: { serviceId } } },
        { items: { some: { serviceId } } },
      ],
    },
  });
  return activeCount > 0;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createService(formData: FormData): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!(formData instanceof FormData)) return { ok: false, error: t("invalidForm") };
  const parsed = parseCommonFields(formData, t);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let coverImage: string | null = null;
  let id: string;
  let slug = parsed.data.slug ?? slugify(parsed.data.title, "service");
  try {
    const cover = coverFile(formData, t);
    if (!cover) return { ok: false, error: t("coverRequired") };
    slug = await resolveServiceSlug(slug);
    coverImage = await saveImageUpload(cover, "services");
    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          ...parsed.data,
          isActive: parsed.data.isPublished,
          slug,
          // SQLite has no JSON column: lists are stored as JSON strings.
          includes: toJsonArray(parsed.data.includes),
          shapes: toJsonArray(parsed.data.shapes),
          coverImage: coverImage!,
        },
      });
      await recordActivity(tx, { action: "created", entityType: "service", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    id = service.id;
  } catch (error) {
    await cleanupUpload(coverImage, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: t("slugExistsService") };
    console.error("Failed to create service:", error);
    return { ok: false, error: t("createServiceFailed") };
  }
  revalidateService(id, slug);
  return { ok: true, id };
}

export async function updateService(id: string, formData: FormData): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128 || !(formData instanceof FormData)) return { ok: false, error: t("invalidRequest") };
  const parsed = parseCommonFields(formData, t);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  let newCover: string | null = null;
  let oldCover: string | null = null;
  let slug = parsed.data.slug ?? "";
  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: t("serviceNotFound") };
    oldCover = existing.coverImage;
    // An existing service keeps its URL unless the form explicitly sends a new slug.
    slug = parsed.data.slug ? await resolveServiceSlug(parsed.data.slug, id) : existing.slug;
    const cover = coverFile(formData, t);
    if (cover) newCover = await saveImageUpload(cover, "services");
    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          ...parsed.data,
          isActive: parsed.data.isPublished,
          slug,
          includes: toJsonArray(parsed.data.includes),
          shapes: toJsonArray(parsed.data.shapes),
          ...(newCover ? { coverImage: newCover } : {}),
        },
      });
      await recordActivity(tx, { action: "updated", entityType: "service", entityId: id, title: parsed.data.title, actorId: admin.id });
    });
  } catch (error) {
    await cleanupUpload(newCover, "services");
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: t("slugExistsService") };
    console.error("Failed to update service:", error);
    return { ok: false, error: t("updateServiceFailed") };
  }
  if (newCover) await cleanupUpload(oldCover, "services");
  revalidateService(id, slug);
  return { ok: true, id };
}

export async function bulkUpdateServices(ids: string[], action: "publish" | "unpublish" | "delete"): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return { ok: false, error: t("selectValidService") };
  }
  if (action === "delete") {
    for (const id of ids) {
      if (await hasActiveOrdersForService(prisma, id)) {
        return { ok: false, error: t("cannotDeleteServiceWithActiveOrders") };
      }
    }
  }
  const removedCovers: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const service = await tx.service.findUnique({ where: { id } });
        if (!service) continue;
        if (action === "delete") {
          if (service.coverImage) removedCovers.push(service.coverImage);
          await tx.service.delete({ where: { id } });
          await recordActivity(tx, { action: "deleted", entityType: "service", entityId: id, title: service.title, actorId: admin.id });
        } else {
          const isPublished = action === "publish";
          await tx.service.update({ where: { id }, data: { isPublished, isActive: isPublished } });
          await recordActivity(tx, { action: isPublished ? "published" : "unpublished", entityType: "service", entityId: id, title: service.title, actorId: admin.id });
        }
      }
    });
  } catch (error) {
    console.error("Failed to update services in bulk:", error);
    return { ok: false, error: t("bulkUpdateServicesFailed") };
  }
  await Promise.all(removedCovers.map((cover) => cleanupUpload(cover, "services")));
  ids.forEach((id) => revalidateService(id));
  revalidatePath("/admin/services");
  return { ok: true };
}

export async function duplicateService(id: string): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: t("invalidServiceId") };
  try {
    const source = await prisma.service.findUnique({ where: { id } });
    if (!source) return { ok: false, error: t("serviceNotFound") };
    const slug = await resolveServiceSlug(`${source.slug}-copy`);
    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          title: `${source.title} (Copy)`,
          slug,
          category: source.category,
          shortDesc: source.shortDesc,
          fullDesc: source.fullDesc,
          includes: source.includes,
          shapes: source.shapes,
          resultText: source.resultText,
          coverImage: source.coverImage,
          isPublished: false,
          sortOrder: source.sortOrder + 1,
        },
      });
      await recordActivity(tx, { action: "duplicated", entityType: "service", entityId: created.id, title: created.title, actorId: admin.id });
      return created;
    });
    revalidatePath("/admin/services");
    return { ok: true, id: copy.id };
  } catch (error) {
    console.error("Failed to duplicate service:", error);
    return { ok: false, error: t("duplicateServiceFailed") };
  }
}

export async function deleteService(id: string): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof id !== "string" || !id || id.length > 128) return { ok: false, error: t("invalidServiceId") };
  // ЖЁСТКОЕ ОГРАНИЧЕНИЕ: запрещено удалять услугу, если на неё есть активные заказы.
  if (await hasActiveOrdersForService(prisma, id)) {
    return { ok: false, error: t("cannotDeleteServiceWithActiveOrders") };
  }
  let cover: string | null = null;
  let slug = "";
  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.service.delete({ where: { id } });
      cover = deleted.coverImage;
      slug = deleted.slug;
      await recordActivity(tx, { action: "deleted", entityType: "service", entityId: id, title: deleted.title, actorId: admin.id });
    });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { ok: false, error: t("deleteServiceFailed") };
  }
  await cleanupUpload(cover, "services");
  revalidateService(id, slug);
  return { ok: true, id };
}

/**
 * Быстрая правка цены прямо из таблицы.
 *
 * Цена — самое часто меняемое поле услуги: пересчитали себестоимость,
 * поменяли тираж — и надо поправить одну цифру. Ради этого открывать
 * форму целиком неудобно, а правка напрямую в списке экономит поход по
 * трём экранам.
 *
 * Сумма приходит в рублях (её вводит человек), хранится в копейках.
 */
export async function updateServicePrice(input: {
  serviceId: string;
  basePriceRub: string;
}): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof input?.serviceId !== "string" || !input.serviceId || input.serviceId.length > 128) {
    return { ok: false, error: t("invalidRequest") };
  }

  const raw = String(input.basePriceRub ?? "").trim().replace(",", ".");
  // Пустое поле — не «бесплатно»: Number("") === 0, и услуга стала бы
  // бесплатной. Проверяем до преобразования.
  if (!raw) return { ok: false, error: t("invalidPrice") };
  const rubles = Number(raw);
  if (!Number.isFinite(rubles) || rubles < 0) return { ok: false, error: t("invalidPrice") };
  if (rubles > 100_000_000) return { ok: false, error: t("invalidPrice") };
  const basePrice = Math.round(rubles * 100);

  try {
    const existing = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!existing) return { ok: false, error: t("serviceNotFound") };
    if (existing.basePrice === basePrice) return { ok: true };

    // ЖЁСТКОЕ ОГРАНИЧЕНИЕ: запрещено менять цену услуги, если она уже включена в активный заказ.
    if (await hasActiveOrdersForService(prisma, input.serviceId)) {
      return { ok: false, error: t("cannotChangePriceWithActiveOrders") };
    }

    await prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id: input.serviceId }, data: { basePrice } });
      await recordActivity(tx, {
        action: "updated",
        entityType: "service",
        entityId: input.serviceId,
        title: `${existing.title} — ${(basePrice / 100).toLocaleString("ru-RU")} ₽`,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to update the service price:", error);
    return { ok: false, error: t("updateServiceFailed") };
  }

  revalidateService(input.serviceId);
  return { ok: true };
}

/**
 * Тип цены: «ровно», «от» или «по запросу».
 *
 * Влияет и на витрину, и на заказ: при «по запросу» кнопка покупки
 * недоступна, потому что назвать цену может только менеджер.
 */
export async function updateServicePriceType(input: {
  serviceId: string;
  priceType: string;
  isOrderable?: boolean;
}): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof input?.serviceId !== "string" || !input.serviceId || input.serviceId.length > 128) {
    return { ok: false, error: t("invalidRequest") };
  }
  if (!PRICE_TYPES.includes(input.priceType as (typeof PRICE_TYPES)[number])) {
    return { ok: false, error: t("invalidPriceType") };
  }

  try {
    const existing = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!existing) return { ok: false, error: t("serviceNotFound") };
    if (existing.priceType !== input.priceType && (await hasActiveOrdersForService(prisma, input.serviceId))) {
      return { ok: false, error: t("cannotChangePriceWithActiveOrders") };
    }

    // «По запросу» означает, что цену называет менеджер, — самостоятельно
    // заказать такое нельзя. Остальные типы оставляем как было.
    const isOrderable = input.priceType === "quote" ? false : input.isOrderable ?? existing.isOrderable;

    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: input.serviceId },
        data: { priceType: input.priceType, isOrderable },
      });
      await recordActivity(tx, {
        action: "updated",
        entityType: "service",
        entityId: input.serviceId,
        title: `${existing.title} — ${input.priceType}`,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to update the service price type:", error);
    return { ok: false, error: t("updateServiceFailed") };
  }

  revalidateService(input.serviceId);
  return { ok: true };
}

export async function toggleServiceActive(input: {
  serviceId: string;
  isActive: boolean;
}): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };
  if (typeof input?.serviceId !== "string" || !input.serviceId || input.serviceId.length > 128) {
    return { ok: false, error: t("invalidRequest") };
  }
  if (typeof input.isActive !== "boolean") {
    return { ok: false, error: t("invalidRequest") };
  }

  let slug = "";
  try {
    const existing = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!existing) return { ok: false, error: t("serviceNotFound") };
    slug = existing.slug;

    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: input.serviceId },
        data: { isActive: input.isActive, isPublished: input.isActive },
      });
      await recordActivity(tx, {
        action: input.isActive ? "published" : "unpublished",
        entityType: "service",
        entityId: input.serviceId,
        title: existing.title,
        actorId: admin.id,
      });
    });
  } catch (error) {
    console.error("Failed to toggle service visibility:", error);
    return { ok: false, error: t("updateServiceFailed") };
  }

  revalidateService(input.serviceId, slug);
  return { ok: true, id: input.serviceId };
}

export interface QuickServiceInput {
  id?: string;
  title: string;
  slug?: string;
  category: string;
  description?: string;
  basePriceRub: string;
  isActive?: boolean;
}

export async function saveQuickService(input: QuickServiceInput): Promise<ServiceActionResult> {
  const t = await getActionTranslator();
  const admin = await requireAdmin();
  if (!admin || !prisma) return { ok: false, error: t("unauthorized") };

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 160) {
    return { ok: false, error: t("validation.titleRequired") };
  }

  const category = typeof input?.category === "string" ? input.category.trim() : "";
  if (category !== "small" && category !== "large") {
    return { ok: false, error: t("validation.categoryInvalid") };
  }

  const rawPrice = String(input?.basePriceRub ?? "").trim().replace(",", ".");
  if (!rawPrice) return { ok: false, error: t("invalidPrice") };
  const rubles = Number(rawPrice);
  if (!Number.isFinite(rubles) || rubles < 0 || rubles > 100_000_000) {
    return { ok: false, error: t("invalidPrice") };
  }
  const basePrice = Math.round(rubles * 100);

  const description = typeof input?.description === "string" ? input.description.trim().slice(0, 500) : "";
  const isActive = input?.isActive ?? true;
  const requestedSlug = typeof input?.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (requestedSlug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(requestedSlug)) {
    return { ok: false, error: t("validation.slugPattern") };
  }

  try {
    if (input.id) {
      if (typeof input.id !== "string" || input.id.length > 128) {
        return { ok: false, error: t("invalidServiceId") };
      }
      const existing = await prisma.service.findUnique({ where: { id: input.id } });
      if (!existing) return { ok: false, error: t("serviceNotFound") };

      // ЖЁСТКОЕ ОГРАНИЧЕНИЕ: запрещено менять цену услуги, если она уже включена в активный заказ.
      if (existing.basePrice !== basePrice && (await hasActiveOrdersForService(prisma, input.id))) {
        return { ok: false, error: t("cannotChangePriceWithActiveOrders") };
      }

      const slug = requestedSlug ? await resolveServiceSlug(requestedSlug, input.id) : existing.slug;
      const shortDesc = description || existing.shortDesc || title;
      const nextPriceType =
        basePrice > 0
          ? existing.priceType === "quote"
            ? "from"
            : existing.priceType
          : "quote";

      await prisma.$transaction(async (tx) => {
        await tx.service.update({
          where: { id: input.id },
          data: {
            title,
            slug,
            category,
            shortDesc,
            basePrice,
            priceType: nextPriceType,
            isOrderable: basePrice > 0,
            isActive,
            isPublished: isActive,
          },
        });
        await recordActivity(tx, {
          action: "updated",
          entityType: "service",
          entityId: input.id!,
          title,
          actorId: admin.id,
        });
      });

      revalidateService(input.id, slug);
      return { ok: true, id: input.id };
    }

    const baseSlug = requestedSlug || slugify(title, "service");
    const slug = await resolveServiceSlug(baseSlug);
    const shortDesc = description || title;
    const coverImage =
      category === "large"
        ? "/assets/shop/billboard.jpg"
        : "/assets/shop/sign-design.jpg";

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.service.create({
        data: {
          title,
          slug,
          category,
          shortDesc,
          fullDesc: shortDesc,
          includes: toJsonArray([shortDesc]),
          shapes: toJsonArray(["Custom layout"]),
          resultText: "Production-ready design layout and realistic preview.",
          coverImage,
          basePrice,
          priceType: basePrice > 0 ? "from" : "quote",
          isOrderable: basePrice > 0,
          isActive,
          isPublished: isActive,
        },
      });
      await recordActivity(tx, {
        action: "created",
        entityType: "service",
        entityId: row.id,
        title: row.title,
        actorId: admin.id,
      });
      return row;
    });

    revalidateService(created.id, slug);
    return { ok: true, id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: t("slugExistsService") };
    console.error("Failed to save service:", error);
    return { ok: false, error: t("updateServiceFailed") };
  }
}
