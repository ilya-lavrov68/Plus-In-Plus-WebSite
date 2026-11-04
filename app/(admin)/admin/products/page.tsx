import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProducts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminProductsPage() {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const products = await getProducts();
  const money = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{t.products.title}</h1>
          <p className="text-sm text-muted-foreground">{t.products.subtitle}</p>
        </div>
        {staff?.isAdmin ? (
          <Link
            href="/admin/products/new"
            className="inline-flex h-10 items-center border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.product.create}
          </Link>
        ) : null}
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.title}</TableHead>
            <TableHead>{t.table.category}</TableHead>
            <TableHead className="text-right">{t.table.price}</TableHead>
            <TableHead className="text-right">{t.table.stock}</TableHead>
            <TableHead>{t.table.active}</TableHead>
            <TableHead className="text-right">{t.table.open}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">{product.category ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{money.format(product.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{product.stock}</TableCell>
                <TableCell>
                  <Badge variant={product.active ? "default" : "outline"}>
                    {product.active ? t.table.visible : t.table.hidden}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-4">
                    {staff?.isAdmin ? (
                      <Link
                        href={`/admin/products/${encodeURIComponent(product.id)}`}
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        {t.table.editLink}
                      </Link>
                    ) : null}
                    <Link
                      href={`/shop/${product.slug}`}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.table.open}
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
