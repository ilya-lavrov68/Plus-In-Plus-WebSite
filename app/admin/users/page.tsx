import { Users as UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/site/empty-state";
import { getAllUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="mt-2 text-muted-foreground">
        Registered accounts. New accounts are created through the public Register form.
      </p>

      {users.length ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.createdAt.toLocaleDateString("en-GB")}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{user.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
