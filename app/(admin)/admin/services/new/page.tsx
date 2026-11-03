import Link from "next/link";
import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { IMAGE_ACCEPT } from "@/lib/upload-policy";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

import { createService } from "../actions";

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
      <header className="flex flex-col gap-2">
        <Link href="/admin/services" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.services.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.service.create}</h1>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form action={createService} className="flex flex-col gap-5">
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

        <fieldset className="flex flex-col gap-3 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm file:mr-3 file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">{t.image.hint}</p>
        </fieldset>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked />
            {t.service.isActive}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" />
            {t.service.isPublished}
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="h-10 border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.table.create}
          </button>
          <Link
            href="/admin/services"
            className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
