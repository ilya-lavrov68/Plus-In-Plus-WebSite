import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import {
  AdminChip,
  AdminPageHeader,
  adminFilledButtonClass,
  adminTonalButtonClass,
} from "@/components/admin/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";
import { listStudioProducts, studioProductPath } from "@/lib/studio-products";

import { toggleStudioProductPublishedAction } from "./actions";

/**
 * Витрина продуктов студии.
 *
 * Таблица отвечает на три вопроса: что опубликовано, откуда тянется история
 * версий и где посмотреть страницу. Публикация — одна кнопка в строке.
 */
export default async function AdminStudioProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const staff = await requireStaff();
  const [locale, query, products] = await Promise.all([
    getRequestLocale(),
    searchParams,
    listStudioProducts(),
  ]);
  const t = adminLabels(locale);
  const copy = t.studioProduct;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t.studioProducts.title}
        description={t.studioProducts.subtitle}
        actions={
          staff?.isAdmin ? (
            <Link href="/admin/studio-products/new" className={adminFilledButtonClass}>
              {copy.create}
            </Link>
          ) : null
        }
      />

      {query.ok ? (
        <p className="text-sm text-on-surface-variant">{copy.saved}</p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.title}</TableHead>
            <TableHead>{copy.version}</TableHead>
            <TableHead>{copy.changelogPath}</TableHead>
            <TableHead>{copy.published}</TableHead>
            <TableHead className="text-right">{t.table.open}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-on-surface-variant">
                {copy.create}
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link href={`/admin/studio-products/${product.id}`} className="font-medium underline-offset-4 hover:underline">
                    {product.name}
                  </Link>
                  <div className="text-xs text-on-surface-variant">/{product.slug}</div>
                </TableCell>
                <TableCell className="text-on-surface-variant tabular-nums">
                  {product.version || "—"}
                </TableCell>
                <TableCell className="text-on-surface-variant">
                  {product.changelogSyncedAt ? (
                    <span title={product.changelogSyncedAt}>
                      {copy.syncedAt}: {new Date(product.changelogSyncedAt).toLocaleDateString(
                        locale === "ru" ? "ru-RU" : "en-GB",
                      )}
                    </span>
                  ) : (
                    copy.notSynced
                  )}
                </TableCell>
                <TableCell>
                  {staff?.isAdmin ? (
                    <form action={toggleStudioProductPublishedAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className={adminTonalButtonClass}>
                        <AdminChip tone={product.published ? "primary" : "neutral"}>
                          {product.published ? copy.published : "—"}
                        </AdminChip>
                      </button>
                    </form>
                  ) : (
                    <AdminChip tone={product.published ? "primary" : "neutral"}>
                      {product.published ? copy.published : "—"}
                    </AdminChip>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={studioProductPath(product)}
                    target="_blank"
                    className="text-sm underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                  >
                    {studioProductPath(product)}
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
