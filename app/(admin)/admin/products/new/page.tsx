import Link from "next/link";
import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

import { createProduct } from "../actions";

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
        <Link href="/admin/products" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.products.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.product.create}</h1>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
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

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked />
          {t.product.isActive}
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="h-10 border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.table.create}
          </button>
          <Link
            href="/admin/products"
            className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
