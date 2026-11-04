import Link from "next/link";
import { notFound } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { IMAGE_ACCEPT } from "@/lib/upload-policy";
import { requireStaff } from "@/lib/admin-session";
import { row } from "@/lib/db";
import { countActiveServiceOrders } from "@/lib/service-rules";
import { getRequestLocale } from "@/lib/request-locale";

import { saveService } from "../actions";

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  short_desc: string;
  full_desc: string;
  base_price: number;
  price_type: string;
  is_published: number;
  is_active: number;
  sort_order: number;
  cover_image: string | null;
}

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

export default async function AdminServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const staff = await requireStaff();
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const service = await row<ServiceRow>(
    `select id, title, slug, category, short_desc, full_desc, base_price, price_type,
       is_published, is_active, sort_order, cover_image
     from services where id = ?`,
    [id],
  );
  if (!service) notFound();

  const activeOrders = await countActiveServiceOrders(id);
  const pricingLocked = activeOrders > 0 && !staff?.isFounder;
  const canEdit = Boolean(staff?.isAdmin);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/services" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.services.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{service.title}</h1>
        <p className="text-sm text-muted-foreground">
          /{service.slug} · {t.services.subtitle}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.service.saved}
        </p>
      ) : null}
      {activeOrders > 0 ? (
        <p className="border border-border px-4 py-3 text-sm text-muted-foreground">
          {t.service.activeOrders.replace("{count}", String(activeOrders))}
        </p>
      ) : null}

      {canEdit ? (
        <form action={saveService} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={service.id} />

          <label className={labelClass}>
            {t.service.title}
            <input name="title" defaultValue={service.title} maxLength={120} required className={inputClass} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.table.category}
              <select name="category" defaultValue={service.category === "large" ? "large" : "small"} className={inputClass}>
                <option value="small">{t.service.categorySmall}</option>
                <option value="large">{t.service.categoryLarge}</option>
              </select>
            </label>
            <label className={labelClass}>
              {t.service.priceType}
              <select name="priceType" defaultValue={service.price_type === "quote" ? "quote" : "from"} className={inputClass}>
                <option value="from">{t.service.priceFrom}</option>
                <option value="quote">{t.table.quote}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.service.priceRubles}
              <input
                name="basePrice"
                type="number"
                min={0}
                max={100_000_000}
                step="1"
                defaultValue={Math.round(Number(service.base_price) / 100)}
                disabled={pricingLocked}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t.service.sortOrder}
              <input
                name="sortOrder"
                type="number"
                step="1"
                defaultValue={Number(service.sort_order)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            {t.service.shortDesc}
            <textarea name="shortDesc" defaultValue={service.short_desc} rows={3} className={`${inputClass} h-auto py-2`} />
          </label>

          <label className={labelClass}>
            {t.service.fullDesc}
            <textarea name="fullDesc" defaultValue={service.full_desc} rows={8} className={`${inputClass} h-auto py-2`} />
          </label>

        <fieldset className="flex flex-col gap-3 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <input type="hidden" name="currentCover" value={service.cover_image ?? ""} />
          {service.cover_image ? (
            <div className="flex flex-col gap-2">
              <img src={service.cover_image} alt="" className="h-32 w-auto border border-border object-cover" />
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

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublished" defaultChecked={Boolean(service.is_published)} />
              {t.service.isPublished}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={Boolean(service.is_active)} />
              {t.service.isActive}
            </label>
          </div>

          {pricingLocked ? (
            <p className="text-xs text-muted-foreground">{t.service.pricingLocked}</p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              className="h-10 border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.table.save}
            </button>
            <Link
              href="/admin/services"
              className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.service.cancel}
            </Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t.service.readOnly}</p>
      )}
    </div>
  );
}
