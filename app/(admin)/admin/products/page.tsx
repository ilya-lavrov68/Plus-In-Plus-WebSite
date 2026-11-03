import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProducts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminProductsPage() {
  await requireStaff();
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
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.products.title}</h1>
        <p className="text-sm text-muted-foreground">{t.products.subtitle}</p>
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
                  <Link
                    href={`/shop/${product.slug}`}
                    className="text-xs underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.table.open}
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
