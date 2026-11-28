"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import {
  createStudioProduct,
  deleteStudioProduct,
  getStudioProductById,
  normalizeSlug,
  saveStudioProductChangelog,
  setStudioProductPublished,
  updateStudioProduct,
  type StudioProductInput,
} from "@/lib/studio-products";
import { fetchStudioChangelog, StudioSyncError } from "@/lib/studio-product-sync";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function inputFrom(formData: FormData): StudioProductInput {
  return {
    slug: normalizeSlug(field(formData, "slug") || field(formData, "name")),
    name: field(formData, "name"),
    taglineRu: field(formData, "taglineRu"),
    taglineEn: field(formData, "taglineEn"),
    summaryRu: field(formData, "summaryRu"),
    summaryEn: field(formData, "summaryEn"),
    version: field(formData, "version"),
    statusLabel: field(formData, "statusLabel"),
    repoUrl: field(formData, "repoUrl"),
    changelogPath: field(formData, "changelogPath") || "CHANGELOG.md",
    downloadUrl: field(formData, "downloadUrl"),
    pagePath: field(formData, "pagePath"),
    facts: field(formData, "facts")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    published: checkbox(formData, "published"),
    sortOrder: Number(field(formData, "sortOrder") || "0"),
  };
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/**
 * Создание продукта из админки.
 *
 * Публикация — это один флажок: пока он снят, страница продукта и строка в меню
 * шапки не появляются. Никакой отдельной сборки или деплоя не нужно.
 */
export async function createStudioProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const input = inputFrom(formData);
  if (input.name.length < 2) fail("/admin/studio-products/new", "Название: минимум 2 символа.");
  if (!input.slug) fail("/admin/studio-products/new", "Slug: латиница, цифры и дефис.");

  const id = await createStudioProduct(input);

  await logAdminAction({
    action: "studioProduct.created",
    entityType: "studioProduct",
    entityId: id,
    title: input.name,
    actorId: admin.id,
  });

  revalidatePath("/admin/studio-products");
  redirect(`/admin/studio-products/${id}?ok=1`);
}

/** Сохранение продукта: текст, ссылки, факты, публикация, порядок в меню. */
export async function saveStudioProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  if (!id) return;

  const path = `/admin/studio-products/${id}`;
  const input = inputFrom(formData);
  if (input.name.length < 2) fail(path, "Название: минимум 2 символа.");
  if (!input.slug) fail(path, "Slug: латиница, цифры и дефис.");

  await updateStudioProduct(id, input);
  await logAdminAction({
    action: "studioProduct.updated",
    entityType: "studioProduct",
    entityId: id,
    title: input.name,
    actorId: admin.id,
  });

  revalidatePath("/admin/studio-products");
  revalidatePath("/products/" + input.slug);
  revalidatePath(input.pagePath || "/");
  redirect(`${path}?ok=1`);
}

/** Быстрая публикация из списка: снять или поставить продукт на витрину. */
export async function toggleStudioProductPublishedAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  const product = await getStudioProductById(id);
  if (!product) return;

  const published = !product.published;
  await setStudioProductPublished(id, published);
  await logAdminAction({
    action: published ? "studioProduct.published" : "studioProduct.unpublished",
    entityType: "studioProduct",
    entityId: id,
    title: product.name,
    actorId: admin.id,
  });

  revalidatePath("/admin/studio-products");
  revalidatePath("/products/" + product.slug);
}

export async function deleteStudioProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  const product = await getStudioProductById(id);
  if (!product) return;

  await deleteStudioProduct(id);
  await logAdminAction({
    action: "studioProduct.deleted",
    entityType: "studioProduct",
    entityId: id,
    title: product.name,
    actorId: admin.id,
  });

  revalidatePath("/admin/studio-products");
  redirect("/admin/studio-products");
}

/**
 * Синхронизация истории версий.
 *
 * Читает репозиторий продукта на GitHub: CHANGELOG.md, теги и релизы. Это
 * ровно те же данные и тем же парсером, что и `npm run changelog:sync` у Line
 * Launcher, — просто по кнопке и для любого продукта из списка.
 */
export async function syncStudioProductChangelogAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  const product = await getStudioProductById(id);
  if (!product) return;

  const path = `/admin/studio-products/${id}`;

  if (!product.repoUrl) {
    fail(path, "Сначала укажите ссылку на репозиторий продукта.");
  }

  try {
    const { data, entriesCount } = await fetchStudioChangelog({
      repoUrl: product.repoUrl,
      changelogPath: product.changelogPath,
    });
    await saveStudioProductChangelog(id, data);
    await logAdminAction({
      action: "studioProduct.changelogSynced",
      entityType: "studioProduct",
      entityId: id,
      title: `${product.name}: ${entriesCount} версий`,
      actorId: admin.id,
    });
  } catch (error) {
    const message =
      error instanceof StudioSyncError
        ? error.message
        : "Не удалось прочитать репозиторий: проверьте ссылку и попробуйте ещё раз.";
    fail(path, message);
  }

  revalidatePath(path);
  revalidatePath("/products/" + product.slug);
  redirect(`${path}?ok=sync`);
}
