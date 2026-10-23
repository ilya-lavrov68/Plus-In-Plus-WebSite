import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { getStaffUserDirectory } from "@/lib/admin-data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  return { title: t("users"), robots: { index: false, follow: false } };
}

export default async function ManagerUsersPage() {
  const [users, locale, t, tc] = await Promise.all([
    getStaffUserDirectory(),
    getRequestLocale(),
    getRequestTranslations("admin"),
    getRequestTranslations("common"),
  ]);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-GB";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("users")}</h1>
      <p className="mt-2 text-muted-foreground">{t("usersSubtitle")}</p>
      <Card className="mt-8">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">{t("user")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("role")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("registered")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || t("noName")}
                    </div>
                  </td>
                  <td className="px-5 py-3">{t(`role${user.role[0]}${user.role.slice(1).toLowerCase()}`)}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" }).format(user.createdAt)}
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-muted-foreground">{tc("noResults")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
