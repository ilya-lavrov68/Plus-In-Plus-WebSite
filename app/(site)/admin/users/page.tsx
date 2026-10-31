import { Users as UsersIcon } from "lucide-react";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { UsersTable } from "@/components/admin/users-table";
import { EmptyState } from "@/components/site/empty-state";
import {
  getAdminUserCount,
  getAllUsers,
  getUserActivities,
  getUserBlockStatuses,
} from "@/lib/admin-data";
import { clampPage, totalPages } from "@/lib/pagination";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [query, total, t] = await Promise.all([
    searchParams,
    getAdminUserCount(),
    getRequestTranslations("admin"),
  ]);
  const page = clampPage(query.page, total);
  const users = await getAllUsers(page);
  const [blockStatuses, activityByUser] = await Promise.all([
    getUserBlockStatuses(users.map((user) => user.id)),
    getUserActivities(users.map((user) => user.id)),
  ]);
  const usersWithActivity = users.map((user) => ({
    ...user,
    isBlocked: Boolean(blockStatuses[user.id]),
    activities: activityByUser[user.id] ?? [],
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("users")}</h1>
      <p className="mt-2 text-muted-foreground">{t("usersSubtitle")}</p>

      {users.length ? (
        <UsersTable users={usersWithActivity} />
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={UsersIcon}
            title={t("noUsers")}
            description={t("noUsersHelp")}
          />
        </div>
      )}
      <AdminPagination
        basePath="/admin/users"
        page={page}
        pageCount={totalPages(total)}
        navigationLabel={t("pagination")}
        previousLabel={t("previousPage")}
        nextLabel={t("nextPage")}
        statusLabel={t("pageStatus", { page, pageCount: totalPages(total) })}
      />
    </div>
  );
}
