import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { AdminChip, AdminPageHeader } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActivity } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminActivityPage() {
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");
  if (!staff.isAdmin) redirect("/admin");

  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const entries = await getActivity(60);
  const dateTime = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t.activity.title} description={t.activity.subtitle} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.date}</TableHead>
            <TableHead>{t.table.action}</TableHead>
            <TableHead>{t.table.entity}</TableHead>
            <TableHead>{t.table.title}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-on-surface-variant">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-on-surface-variant">
                  {entry.createdAt ? dateTime.format(new Date(entry.createdAt)) : "—"}
                </TableCell>
                <TableCell>
                  <AdminChip>{entry.action}</AdminChip>
                </TableCell>
                <TableCell className="text-on-surface-variant">{entry.entityType}</TableCell>
                <TableCell className="max-w-[420px] truncate">{entry.title}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
