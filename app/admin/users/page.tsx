import { Users as UsersIcon } from "lucide-react";

import { UsersTable } from "@/components/admin/users-table";
import { EmptyState } from "@/components/site/empty-state";
import { getAllUsers, getUserActivity, getUserBlockStatuses } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, t] = await Promise.all([getAllUsers(), getRequestTranslations("admin")]);
  const blockStatuses = await getUserBlockStatuses(users.map((user) => user.id));
  const usersWithActivity = await Promise.all(users.map(async (user) => ({
    ...user,
    isBlocked: Boolean(blockStatuses[user.id]),
    activities: await getUserActivity(user.id),
  })));

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
    </div>
  );
}
