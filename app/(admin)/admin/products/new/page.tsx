import Link from "next/link";
import { redirect } from "next/navigation";

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
import { getRequestLocale } from "@/lib/request-locale";

import { createProduct } from "../actions";

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin/products");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const error = typeof query.error === "string" && query.error ? query.error : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/products" className="text-xs text-on-surface-variant underline-offset-4 hover:underline">
          ← {t.products.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.product.create}</h1>
      </header>

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}

      <form action={createProduct} className="flex flex-col gap-5">
        <label className={labelClass}>
          {t.service.title}
          <input name="name" minLength={2} maxLength={120} required autoFocus className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.post.slug}
            <input name="slug" className={inputClass} placeholder="auto" />
          </label>
          <label className={labelClass}>
            {t.table.category}
            <input name="category" className={inputClass} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.product.priceRubles}
            <input name="price" type="number" min={0} max={10_000_000} step="1" required className={inputClass} />
          </label>
          <label className={labelClass}>
            {t.table.stock}
            <input name="stock" type="number" min={0} max={1_000_000} step="1" defaultValue={0} className={inputClass} />
          </label>
        </div>

        <label className={labelClass}>
          {t.service.shortDesc}
          <textarea name="description" rows={5} className={`${inputClass} h-auto py-2`} />
        </label>

        <fieldset className="flex flex-col gap-3 border border-outline-variant p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface hover:file:border-primary" />
          </label>
          <p className="text-xs text-on-surface-variant">{t.image.hint}</p>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked />
          {t.product.isActive}
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className={adminFilledButtonClass}
          >
            {t.table.create}
          </button>
          <Link
            href="/admin/products"
            className={adminTonalButtonClass}
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
