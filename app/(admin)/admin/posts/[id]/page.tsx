import Link from "next/link";
import { notFound } from "next/navigation";

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
import { row } from "@/lib/db";
import { getRequestLocale } from "@/lib/request-locale";

import { listGallery } from "@/lib/post-gallery";

import { savePost, savePostGallery } from "../actions";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  read_time: number;
  source_url: string | null;
  is_published: number;
  is_featured: number;
  published_at: string | null;
  cover_image: string | null;
}

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function AdminPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const staff = await requireStaff();
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getRequestLocale()]);
  const t = adminLabels(locale);

  const post = await row<PostRow>(
    `select id, title, slug, excerpt, content, read_time, source_url, is_published, is_featured,
       published_at, cover_image
     from posts where id = ?`,
    [id],
  );
  if (!post) notFound();

  const gallery = await listGallery(id);

  const canEdit = Boolean(staff?.isAdmin);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        back={{ href: "/admin/posts", label: t.posts.title }}
        title={post.title}
        description={`/blog/${post.slug}${post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB")}` : ""}`}
      />

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}
      {saved ? (
        <AdminStatus tone="success">{t.post.saved}</AdminStatus>
      ) : null}

      {canEdit ? (
        <form action={savePost} className={adminFieldsetClass}>
          <input type="hidden" name="id" value={post.id} />

          <label className={labelClass}>
            {t.post.title}
            <input name="title"defaultValue={post.title} maxLength={160} required className={inputClass} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.post.slug}
              <input name="slug"defaultValue={post.slug} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t.post.readTime}
              <input
                name="readTime"
                type="number"
                min={1}
                max={60}
                defaultValue={Number(post.read_time)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            {t.post.excerpt}
            <textarea name="excerpt"defaultValue={post.excerpt} rows={3} className={`${inputClass} h-auto py-2`} />
          </label>

          <label className={labelClass}>
            {t.post.content}
            <textarea
              name="content"
              defaultValue={post.content}
              rows={18}
              spellCheck={false}
              className={`${inputClass} h-auto py-2 font-mono text-xs`}
            />
          </label>

          <label className={labelClass}>
            {t.post.sourceUrl}
            <input name="sourceUrl"defaultValue={post.source_url ?? ""} className={inputClass} />
          </label>

          <fieldset className="flex flex-col gap-3 p-4">
            <legend className="px-2 text-sm font-semibold">{t.image.title}</legend>
            <input type="hidden" name="currentCover" value={post.cover_image ?? ""} />
            {post.cover_image ? (
              <div className="flex flex-col gap-2">
                <img src={post.cover_image} alt="" className="h-32 w-auto object-cover" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" name="removeCover" />
                  {t.image.remove}
                </label>
              </div>
            ) : null}
            <label className={labelClass}>
              {t.image.upload}
              <input type="file" name="cover"accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface" />
            </label>
            <p className="text-xs text-on-surface-variant">{t.image.hint}</p>
          </fieldset>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" name="isPublished"defaultChecked={Boolean(post.is_published)} />
              {t.post.isPublished}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" name="isFeatured"defaultChecked={Boolean(post.is_featured)} />
              {t.post.isFeatured}
            </label>
          </div>

          <p className="text-xs text-on-surface-variant">{t.post.hint}</p>

          <div className="flex gap-3">
            <button
              type="submit"
              className={adminFilledButtonClass}
            >
              {t.table.save}
            </button>
            <Link
              href="/admin/posts"
              className={adminTonalButtonClass}
            >
              {t.service.cancel}
            </Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-on-surface-variant">{t.post.readOnly}</p>
      )}

      {staff?.isAdmin ? (
        <form action={savePostGallery} className={adminInsetPanelClass}>
          <input type="hidden" name="id" value={post.id} />
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{t.gallery.title}</h2>
            <p className="text-xs text-on-surface-variant">{t.gallery.hint}</p>
          </div>

          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((image) => (
                <label key={image.mediaId} className="flex flex-col gap-2 rounded-lg bg-surface-container p-2 text-xs">
                  <img src={image.url} alt="" className="h-24 w-full object-cover" />
                  <span className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-primary" name="removeGallery" value={image.mediaId} />
                    {t.gallery.remove}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">{t.gallery.empty}</p>
          )}

          <label className={labelClass}>
            {t.gallery.add}
            <input type="file" name="gallery"multiple accept={IMAGE_ACCEPT} className="text-sm text-on-surface-variant file:mr-3 file:rounded-full file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-surface" />
          </label>

          <button
            type="submit"
            className={`${adminTonalButtonClass} h-10`}
          >
            {t.table.save}
          </button>
        </form>
      ) : null}
    </div>
  );
}
