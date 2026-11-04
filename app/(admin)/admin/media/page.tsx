import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireStaff } from "@/lib/admin-session";
import { listMedia } from "@/lib/media-library";
import { getRequestLocale } from "@/lib/request-locale";

import { deleteMediaAction } from "./actions";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const items = await listMedia(60);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const deleted = query.deleted === "1";

  const dateFormat = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.media.title}</h1>
        <p className="text-sm text-muted-foreground">{t.media.subtitle}</p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {deleted ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.media.deleted}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.media.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 border border-border p-4">
              { }
              <img src={item.url} alt={item.alt} className="h-40 w-full border border-border object-cover" />

              <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>{t.media.kind}</dt>
                  <dd className="text-foreground">{item.kind}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.size}</dt>
                  <dd className="tabular-nums text-foreground">{Math.max(1, Math.round(item.filesize / 1024))} KB</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.dimensions}</dt>
                  <dd className="tabular-nums text-foreground">
                    {item.width && item.height ? `${item.width} × ${item.height}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.created}</dt>
                  <dd className="text-foreground">{item.createdAt ? dateFormat.format(new Date(item.createdAt)) : "—"}</dd>
                </div>
              </dl>

              {item.usageCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t.media.inUse.replace("{count}", String(item.usageCount))}
                </p>
              ) : (
                <form action={deleteMediaAction} className="mt-auto">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="h-9 w-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
                  >
                    {t.media.remove}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
