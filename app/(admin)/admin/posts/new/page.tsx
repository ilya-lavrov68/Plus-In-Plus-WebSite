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

import { createPost } from "../actions";

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin/posts");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const error = typeof query.error === "string" && query.error ? query.error : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/posts" className="text-xs text-on-surface-variant underline-offset-4 hover:underline">
          ← {t.posts.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.post.create}</h1>
        <p className="text-sm text-on-surface-variant">{t.post.hint}</p>
      </header>

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}

      <form action={createPost} className="flex flex-col gap-5">
        <label className={labelClass}>
          {t.post.title}
          <input name="title" minLength={2} maxLength={160} required autoFocus className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.post.slug}
            <input name="slug" className={inputClass} placeholder="auto" />
          </label>
          <label className={labelClass}>
            {t.post.readTime}
            <input name="readTime" type="number" min={1} max={60} step="1" defaultValue={5} className={inputClass} />
          </label>
        </div>

        <label className={labelClass}>
          {t.post.excerpt}
          <textarea name="excerpt" rows={3} className={`${inputClass} h-auto py-2`} />
        </label>

        <label className={labelClass}>
          {t.post.content}
          <textarea name="content" rows={16} required className={`${inputClass} h-auto py-2 font-mono`} />
        </label>

        <label className={labelClass}>
          {t.post.sourceUrl}
          <input name="sourceUrl" type="url" placeholder="https://" className={inputClass} />
        </label>

        <fieldset className="flex flex-col gap-3 border border-outline-variant p-4">
          <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
          <label className={labelClass}>
            {t.image.upload}
            <input type="file" name="cover" accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:border file:border-outline file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface hover:file:border-primary" />
          </label>
          <p className="text-xs text-on-surface-variant">{t.image.hint}</p>
        </fieldset>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" />
            {t.post.isPublished}
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
            href="/admin/posts"
            className={adminTonalButtonClass}
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
