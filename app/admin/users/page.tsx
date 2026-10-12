import { Users as UsersIcon } from "lucide-react";

import { UsersTable } from "@/components/admin/users-table";
import { EmptyState } from "@/components/site/empty-state";
import { getAllUsers, getUserActivity, getUserBlockStatuses } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getAllUsers();
  const blockStatuses = await getUserBlockStatuses(users.map((user) => user.id));
  const usersWithActivity = await Promise.all(users.map(async (user) => ({
    ...user,
    isBlocked: Boolean(blockStatuses[user.id]),
    activities: await getUserActivity(user.id),
  })));

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="mt-2 text-muted-foreground">
        Registered accounts. New accounts are created through the public Register form.
      </p>

      {users.length ? (
        <UsersTable users={usersWithActivity} />
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={UsersIcon}
            title="No users yet"
            description="Accounts will appear here after visitors register."
          />
        </div>
      )}
    </div>
  );
}
