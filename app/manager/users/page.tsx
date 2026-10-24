import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { Card, CardContent } from "@/components/ui/card";
import { getStaffUserCount, getStaffUserDirectory } from "@/lib/admin-data";
import { clampPage, totalPages } from "@/lib/pagination";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  return { title: t("users"), robots: { index: false, follow: false } };
}

interface ManagerUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManagerUsersPage({ searchParams }: ManagerUsersPageProps) {
  const [query, total, locale, t, tc] = await Promise.all([
    searchParams,
    getStaffUserCount(),
    getRequestLocale(),
    getRequestTranslations("admin"),
    getRequestTranslations("common"),
  ]);
  const page = clampPage(query.page, total);
  const customers = await getStaffUserDirectory(page);
  const pageCount = totalPages(total);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-GB";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("customers")}</h1>
      <p className="mt-2 text-muted-foreground">{t("customersSubtitle")}</p>
      <Card className="mt-8">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">{t("customer")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("orders")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("registered")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{customer.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {[customer.firstName, customer.lastName].filter(Boolean).join(" ") || t("noName")}
                    </div>
                  </td>
                  <td className="px-5 py-3">{customer.orderCount}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" }).format(customer.createdAt)}
                  </td>
                </tr>
              ))}
              {!customers.length ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-muted-foreground">{tc("noResults")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <AdminPagination
        basePath="/manager/users"
        page={page}
        pageCount={pageCount}
        navigationLabel={t("pagination")}
        previousLabel={t("previousPage")}
        nextLabel={t("nextPage")}
        statusLabel={t("pageStatus", { page, pageCount })}
      />
    </div>
  );
}
