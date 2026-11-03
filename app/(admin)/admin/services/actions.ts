"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { insertService, ServiceRuleError, updateService } from "@/lib/service-rules";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

/**
 * Сохранение услуги из админки. Доступно только ADMIN/FOUNDER, цена
 * проверяется правилами каталога, каждое изменение попадает в журнал.
 */
export async function saveService(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  if (!id) return;

  const title = field(formData, "title");
  const basePrice = Number(field(formData, "basePrice").replace(",", "."));
  const sortOrder = Number(field(formData, "sortOrder") || "0");
  const priceType = field(formData, "priceType") === "quote" ? "quote" : "from";
  const category = field(formData, "category") === "large" ? "large" : "small";

  if (title.length < 2 || title.length > 120) {
    redirect(`/admin/services/${encodeURIComponent(id)}?error=${encodeURIComponent("Название: от 2 до 120 символов.")}`);
  }
  if (!Number.isFinite(basePrice) || basePrice < 0 || basePrice > 100_000_000) {
    redirect(`/admin/services/${encodeURIComponent(id)}?error=${encodeURIComponent("Цена: от 0 до 100 000 000 ₽.")}`);
  }

  try {
    await updateService({
      id,
      title,
      category,
      shortDesc: field(formData, "shortDesc"),
      fullDesc: field(formData, "fullDesc"),
      basePrice,
      priceType,
      isPublished: checkbox(formData, "isPublished"),
      isActive: checkbox(formData, "isActive"),
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    });
  } catch (error) {
    if (error instanceof ServiceRuleError) {
      revalidatePath("/admin/services");
      redirect(`/admin/services/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  await logAdminAction({
    action: "service.updated",
    entityType: "service",
    entityId: id,
    title: `Услуга: ${title}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath("/shop");
  revalidatePath("/");
  redirect(`/admin/services/${encodeURIComponent(id)}?saved=1`);
}

/**
 * Создание услуги. Форма живёт на /admin/services/new; после сохранения
 * открывается карточка, чтобы сразу видеть результат правил каталога.
 */
export async function createService(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const title = field(formData, "title");
  const basePrice = Number(field(formData, "basePrice").replace(",", "."));
  const sortOrder = Number(field(formData, "sortOrder") || "0");

  try {
    const id = await insertService({
      title,
      category: field(formData, "category") === "large" ? "large" : "small",
      shortDesc: field(formData, "shortDesc"),
      fullDesc: field(formData, "fullDesc"),
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      priceType: field(formData, "priceType") === "quote" ? "quote" : "from",
      isPublished: checkbox(formData, "isPublished"),
      isActive: checkbox(formData, "isActive"),
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    });

    await logAdminAction({
      action: "service.created",
      entityType: "service",
      entityId: id,
      title: `Услуга: ${title}`,
      actorId: admin.id,
    });

    revalidatePath("/admin/services");
    revalidatePath("/services");
    revalidatePath("/shop");
    revalidatePath("/");
    redirect(`/admin/services/${encodeURIComponent(id)}?saved=1`);
  } catch (error) {
    if (error instanceof ServiceRuleError) {
      redirect(`/admin/services/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
