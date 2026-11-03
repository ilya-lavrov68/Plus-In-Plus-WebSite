"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin-session";
import { insertProduct, ProductRuleError, updateProduct } from "@/lib/product-rules";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/**
 * Сохранение товара из админки. Доступно ADMIN/FOUNDER, значения проверяются
 * правилами магазина, изменение попадает в журнал активности.
 */
export async function saveProduct(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = field(formData, "id");
  if (!id) return;

  const name = field(formData, "name");
  if (name.length < 2 || name.length > 120) {
    redirect(`/admin/products/${encodeURIComponent(id)}?error=${encodeURIComponent("Название: от 2 до 120 символов.")}`);
  }

  try {
    await updateProduct({
      id,
      name,
      slug: field(formData, "slug"),
      description: field(formData, "description") || null,
      price: Number(field(formData, "price").replace(",", ".")),
      stock: Number(field(formData, "stock") || "0"),
      category: field(formData, "category") || null,
      isActive: formData.get("isActive") === "on",
    });
  } catch (error) {
    if (error instanceof ProductRuleError) {
      revalidatePath("/admin/products");
      redirect(`/admin/products/${encodeURIComponent(id)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  await logAdminAction({
    action: "product.updated",
    entityType: "product",
    entityId: id,
    title: `Товар: ${name}`,
    actorId: admin.id,
  });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(`/admin/products/${encodeURIComponent(id)}?saved=1`);
}

/** Создание товара: цена в рублях, остаток — целое число. */
export async function createProduct(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const name = field(formData, "name");

  try {
    const id = await insertProduct({
      name,
      slug: field(formData, "slug"),
      description: field(formData, "description") || null,
      price: Number(field(formData, "price").replace(",", ".")),
      stock: Number(field(formData, "stock") || "0"),
      category: field(formData, "category") || null,
      isActive: formData.get("isActive") === "on",
    });

    await logAdminAction({
      action: "product.created",
      entityType: "product",
      entityId: id,
      title: `Товар: ${name}`,
      actorId: admin.id,
    });

    revalidatePath("/admin/products");
    revalidatePath("/shop");
    redirect(`/admin/products/${encodeURIComponent(id)}?saved=1`);
  } catch (error) {
    if (error instanceof ProductRuleError) {
      redirect(`/admin/products/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
