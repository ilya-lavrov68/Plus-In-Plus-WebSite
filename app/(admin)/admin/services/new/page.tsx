import Link from "next/link";
import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import {
  AdminPageHeader,
  AdminStatus,
  adminFieldsetClass,
  adminFilledButtonClass,
  adminInputClass,
  adminInsetPanelClass,
  adminLabelClass,
  adminTonalButtonClass,
} from "@/components/admin/ui";
import { IMAGE_ACCEPT } from "@/lib/upload-policy";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

import { createService } from "../actions";

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin/services");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const error = typeof query.error === "string" && query.error ? query.error : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader back={{ href: "/admin/services", label: t.services.title }} title={t.service.create} />

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}

      <form action={createService} className={adminFieldsetClass}>
        <label className={labelClass}>
          {t.service.title}
          <input name="title" maxLength={120} minLength={2} required autoFocus className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.table.category}
            <select name="category" defaultValue="small" className={inputClass}>
              <option value="small">{t.service.categorySmall}</option>
              <option value="large">{t.service.categoryLarge}</option>
            </select>
          </label>
          <label className={labelClass}>
            {t.service.priceType}
            <select name="priceType" defaultValue="from" className={inputClass}>
              <option value="from">{t.service.priceFrom}</option>
              <option value="quote">{t.table.quote}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.service.priceRubles}
            <input name="basePrice" type="number" min={0} max={100_000_000} step="1" defaultValue={0} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t.service.sortOrder}
            <input name="sortOrder" type="number" step="1" defaultValue={0} className={inputClass} />
          </label>
        </div>

        <label className={labelClass}>
          {t.service.shortDesc}
          <textarea name="shortDesc" rows={3} className={`${inputClass} h-auto py-2`} />
        </label>

        <label className={labelClass}>
          {t.service.fullDesc}
          <textarea name="fullDesc" rows={8} className={`${inputClass} h-auto py-2`} />
        </label>

        <fieldset className={adminInsetPanelClass}>
          <legend className="text-sm font-medium text-on-surface">{t.image.title}</legend>
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface hover:file:border-primary" />
          </label>
          <p className="text-xs text-on-surface-variant">{t.image.hint}</p>
        </fieldset>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" name="isActive" defaultChecked />
            {t.service.isActive}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" name="isPublished" />
            {t.service.isPublished}
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className={adminFilledButtonClass}
          >
            {t.table.create}
          </button>
          <Link
            href="/admin/services"
            className={adminTonalButtonClass}
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
