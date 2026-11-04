import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { AdminPageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminAccountsPage() {
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");
  if (!staff.isAdmin) redirect("/admin");

  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const accounts = await getAccounts(100);
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t.accounts.title} description={t.accounts.subtitle} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.email}</TableHead>
            <TableHead>{t.table.name}</TableHead>
            <TableHead>{t.table.role}</TableHead>
            <TableHead>{t.table.blocked}</TableHead>
            <TableHead>{t.table.created}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-on-surface-variant">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="max-w-[260px] truncate font-medium">{account.email}</TableCell>
                <TableCell className="max-w-[200px] truncate text-on-surface-variant">{account.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{t.roles[account.role] ?? account.role}</Badge>
                </TableCell>
                <TableCell className="text-on-surface-variant">{account.blocked ? t.table.yes : t.table.no}</TableCell>
                <TableCell className="whitespace-nowrap text-on-surface-variant">
                  {account.createdAt ? date.format(new Date(account.createdAt)) : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
