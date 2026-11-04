import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { AdminPageHeader, adminFilledButtonClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServices } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminServicesPage() {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const services = await getServices();
  const money = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t.services.title}
        description={t.services.subtitle}
        actions={
          staff?.isAdmin ? (
            <Link href="/admin/services/new" className={adminFilledButtonClass}>
              {t.service.create}
            </Link>
          ) : null
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.title}</TableHead>
            <TableHead>{t.table.category}</TableHead>
            <TableHead className="text-right">{t.table.price}</TableHead>
            <TableHead>{t.table.published}</TableHead>
            <TableHead>{t.table.active}</TableHead>
            <TableHead className="text-right">{t.table.open}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-on-surface-variant">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            services.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium">{service.title}</TableCell>
                <TableCell className="text-on-surface-variant">{service.category}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {service.priceType === "quote" ? t.table.quote : money.format(service.basePrice)}
                </TableCell>
                <TableCell>
                  <Badge variant={service.published ? "default" : "outline"}>
                    {service.published ? t.table.yes : t.table.no}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={service.active ? "default" : "outline"}>
                    {service.active ? t.table.visible : t.table.hidden}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-4">
                    {staff?.isAdmin ? (
                      <Link
                        href={`/admin/services/${encodeURIComponent(service.id)}`}
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        {t.table.editLink}
                      </Link>
                    ) : null}
                    <Link
                      href={`/services/${service.slug}`}
                      className="text-xs text-on-surface-variant underline-offset-4 hover:underline"
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
