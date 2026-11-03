import Link from "next/link";
import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

import { createPost } from "../actions";

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
        <Link href="/admin/posts" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← {t.posts.title}
        </Link>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.post.create}</h1>
        <p className="text-sm text-muted-foreground">{t.post.hint}</p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
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

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" />
            {t.post.isPublished}
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
            href="/admin/posts"
            className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.service.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
