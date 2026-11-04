import Link from "next/link";
import { notFound } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import {
  AdminStatus,
  adminFilledButtonClass,
  adminInputClass,
  adminLabelClass,
  adminTonalButtonClass,
} from "@/components/admin/ui";
import { IMAGE_ACCEPT } from "@/lib/upload-policy";
import { requireStaff } from "@/lib/admin-session";
import { row } from "@/lib/db";
import { getRequestLocale } from "@/lib/request-locale";

import { saveProduct } from "../actions";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  is_active: number;
  cover_image: string | null;
}

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function AdminProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const staff = await requireStaff();
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getRequestLocale()]);
  const t = adminLabels(locale);

  const product = await row<ProductRow>(
    `select id, name, slug, description, price, stock, category, is_active, cover_image from products where id = ?`,
    [id],
  );
  if (!product) notFound();

  const canEdit = Boolean(staff?.isAdmin);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/products" className="text-xs text-on-surface-variant underline-offset-4 hover:underline">
          ← {t.products.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{product.name}</h1>
        <p className="text-sm text-on-surface-variant">/{product.slug}</p>
      </header>

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}
      {saved ? (
        <AdminStatus tone="success">{t.product.saved}</AdminStatus>
      ) : null}

      {canEdit ? (
        <form action={saveProduct} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={product.id} />

          <label className={labelClass}>
            {t.service.title}
            <input name="name" defaultValue={product.name} maxLength={120} required className={inputClass} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.post.slug}
              <input name="slug" defaultValue={product.slug} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t.table.category}
              <input name="category" defaultValue={product.category ?? ""} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.product.priceRubles}
              <input
                name="price"
                type="number"
                min={0}
                max={10_000_000}
                step="1"
                defaultValue={Number(product.price)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t.table.stock}
              <input
                name="stock"
                type="number"
                min={0}
                max={1_000_000}
                step="1"
                defaultValue={Number(product.stock)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            {t.service.shortDesc}
            <textarea
              name="description"
              defaultValue={product.description ?? ""}
              rows={5}
              className={`${inputClass} h-auto py-2`}
            />
          </label>

        <fieldset className="flex flex-col gap-3 border border-outline-variant p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <input type="hidden" name="currentCover" value={product.cover_image ?? ""} />
          {product.cover_image ? (
            <div className="flex flex-col gap-2">
              <img src={product.cover_image} alt="" className="h-32 w-auto border border-outline-variant object-cover" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removeCover" />
                {t.image.remove}
              </label>
            </div>
          ) : null}
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface hover:file:border-primary" />
          </label>
          <p className="text-xs text-on-surface-variant">{t.image.hint}</p>
        </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={Boolean(product.is_active)} />
            {t.product.isActive}
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              className={adminFilledButtonClass}
            >
              {t.table.save}
            </button>
            <Link
              href="/admin/products"
              className={adminTonalButtonClass}
            >
              {t.service.cancel}
            </Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-on-surface-variant">{t.product.readOnly}</p>
      )}
    </div>
  );
}
