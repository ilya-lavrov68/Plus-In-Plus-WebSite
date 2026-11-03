import Link from "next/link";
import { notFound } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireStaff } from "@/lib/admin-session";
import { row } from "@/lib/db";
import { getRequestLocale } from "@/lib/request-locale";

import { savePost } from "../actions";

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
}

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
    `select id, title, slug, excerpt, content, read_time, source_url, is_published, is_featured, published_at
     from posts where id = ?`,
    [id],
  );
  if (!post) notFound();

  const canEdit = Boolean(staff?.isAdmin);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/admin/posts" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.posts.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{post.title}</h1>
        <p className="text-sm text-muted-foreground">
          /blog/{post.slug}
          {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB")}` : ""}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.post.saved}
        </p>
      ) : null}

      {canEdit ? (
        <form action={savePost} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={post.id} />

          <label className={labelClass}>
            {t.post.title}
            <input name="title" defaultValue={post.title} maxLength={160} required className={inputClass} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              {t.post.slug}
              <input name="slug" defaultValue={post.slug} className={inputClass} />
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
            <textarea name="excerpt" defaultValue={post.excerpt} rows={3} className={`${inputClass} h-auto py-2`} />
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
            <input name="sourceUrl" defaultValue={post.source_url ?? ""} className={inputClass} />
          </label>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublished" defaultChecked={Boolean(post.is_published)} />
              {t.post.isPublished}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isFeatured" defaultChecked={Boolean(post.is_featured)} />
              {t.post.isFeatured}
            </label>
          </div>

          <p className="text-xs text-muted-foreground">{t.post.hint}</p>

          <div className="flex gap-3">
            <button
              type="submit"
              className="h-10 border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.table.save}
            </button>
            <Link
              href="/admin/posts"
              className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
            >
              {t.service.cancel}
            </Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t.post.readOnly}</p>
      )}
    </div>
  );
}
