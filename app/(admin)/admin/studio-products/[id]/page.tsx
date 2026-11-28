import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { StudioProductForm } from "@/components/admin/studio-product-form";
import {
  AdminPageHeader,
  AdminStatus,
  adminDangerButtonClass,
  adminTonalButtonClass,
} from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";
import { getStudioProductById, studioProductPath } from "@/lib/studio-products";
import type { ChangelogData } from "@/lib/changelog-format";

import {
  deleteStudioProductAction,
  saveStudioProductAction,
  syncStudioProductChangelogAction,
} from "../actions";

/**
 * Карточка продукта.
 *
 * Сверху — публикация и синхронизация истории версий, ниже — форма. Порядок
 * важен: владелец сначала видит состояние продукта, а потом правит текст.
 */
export default async function EditStudioProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin/studio-products");

  const [{ id }, query, locale] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
  ]);
  const product = await getStudioProductById(id).catch(() => null);
  if (!product) notFound();

  const t = adminLabels(locale);
  const copy = t.studioProduct;
  const changelog = product.changelog as ChangelogData | null;
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const ok = typeof query.ok === "string" ? query.ok : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        back={{ href: "/admin/studio-products", label: t.studioProducts.title }}
        title={product.name}
        description={studioProductPath(product)}
        actions={
          <Link
            href={studioProductPath(product)}
            target="_blank"
            className="text-sm underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
          >
            {t.table.open}
          </Link>
        }
      />

      {ok === "sync" ? <AdminStatus tone="success">{copy.synced}</AdminStatus> : null}
      {ok === "1" ? <AdminStatus tone="success">{copy.saved}</AdminStatus> : null}
      {error ? <AdminStatus tone="error">{error}</AdminStatus> : null}

      <section className="flex flex-col gap-3 rounded-xl bg-surface-container p-5">
        <p className="text-sm font-medium text-on-surface">{copy.sync}</p>
        <p className="text-xs leading-relaxed text-on-surface-variant">{copy.syncHint}</p>
        <p className="text-xs text-on-surface-variant">
          {changelog
            ? `${copy.syncedAt}: ${new Date(product.changelogSyncedAt ?? "").toLocaleString(
                locale === "ru" ? "ru-RU" : "en-GB",
              )} · ${changelog.entries.length} ${copy.entries} · ${changelog.repository}`
            : copy.notSynced}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form action={syncStudioProductChangelogAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit" className={adminTonalButtonClass}>
              {copy.sync}
            </button>
          </form>
          <form action={deleteStudioProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit" className={adminDangerButtonClass}>
              {copy.delete}
            </button>
          </form>
        </div>
      </section>

      <StudioProductForm t={t} action={saveStudioProductAction} product={product} />
    </div>
  );
}
