import Link from "next/link";
import { notFound } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
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

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
        <Link href="/admin/products" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.products.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{product.name}</h1>
        <p className="text-sm text-muted-foreground">/{product.slug}</p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.product.saved}
        </p>
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

        <fieldset className="flex flex-col gap-3 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <input type="hidden" name="currentCover" value={product.cover_image ?? ""} />
          {product.cover_image ? (
            <div className="flex flex-col gap-2">
              { }
              <img src={product.cover_image} alt="" className="h-32 w-auto border border-border object-cover" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removeCover" />
                {t.image.remove}
              </label>
            </div>
          ) : null}
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm file:mr-3 file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">{t.image.hint}</p>
        </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={Boolean(product.is_active)} />
            {t.product.isActive}
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              className="h-10 border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.table.save}
            </button>
            <Link
              href="/admin/products"
              className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.service.cancel}
            </Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t.product.readOnly}</p>
      )}
    </div>
  );
}
