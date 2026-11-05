import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { AdminPageHeader, AdminStatus } from "@/components/admin/ui";
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
      <AdminPageHeader title={t.media.title} description={t.media.subtitle} />

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}
      {deleted ? (
        <AdminStatus tone="success">{t.media.deleted}</AdminStatus>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t.media.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 overflow-hidden rounded-xl bg-surface-container-low p-4"
            >
              <img
                src={item.url}
                alt={item.alt}
                className="h-40 w-full rounded-lg bg-surface-container-lowest object-cover"
              />

              <dl className="flex flex-col gap-1 text-xs text-on-surface-variant">
                <div className="flex justify-between gap-3">
                  <dt>{t.media.kind}</dt>
                  <dd className="text-on-surface">{item.kind}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.size}</dt>
                  <dd className="tabular-nums text-on-surface">{Math.max(1, Math.round(item.filesize / 1024))} KB</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.dimensions}</dt>
                  <dd className="tabular-nums text-on-surface">
                    {item.width && item.height ? `${item.width} × ${item.height}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{t.media.created}</dt>
                  <dd className="text-on-surface">{item.createdAt ? dateFormat.format(new Date(item.createdAt)) : "—"}</dd>
                </div>
              </dl>

              {item.usageCount > 0 ? (
                <p className="text-xs text-on-surface-variant">
                  {t.media.inUse.replace("{count}", String(item.usageCount))}
                </p>
              ) : (
                <form action={deleteMediaAction} className="mt-auto">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="inline-flex h-9 w-full items-center justify-center rounded-full text-xs font-medium text-on-surface-variant transition-colors hover:bg-error/12 hover:text-error focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
