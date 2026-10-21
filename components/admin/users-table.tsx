"use client";

import { useState } from "react";
import { KeyRound, Lock, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";

import { resetUserPassword, toggleUserBlocked, updateUserRole } from "@/app/actions/admin";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isBlocked: boolean;
  createdAt: Date;
  activities: { id: string; action: string; entityType: string; title: string; createdAt: Date }[];
}

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const changeRole = async (id: string, role: "USER" | "MANAGER" | "ADMIN") => {
    setPending(id);
    setMessage(null);
    const result = await updateUserRole(id, role);
    setPending(null);
    setMessage(result.ok ? t("roleUpdated") : result.error ?? t("roleUpdateFailed"));
    if (result.ok) window.location.reload();
  };

  const block = async (user: AdminUserRow) => {
    setPending(user.id);
    setMessage(null);
    const result = await toggleUserBlocked(user.id, !user.isBlocked);
    setPending(null);
    setMessage(
      result.ok
        ? user.isBlocked
          ? t("userUnlocked")
          : t("userBlocked")
        : result.error ?? t("statusUpdateFailed")
    );
    if (result.ok) window.location.reload();
  };

  const reset = async (id: string) => {
    if (!window.confirm(t("confirmResetPassword"))) return;
    setPending(id);
    setMessage(null);
    const result = await resetUserPassword(id);
    setPending(null);
    if (result.ok && result.temporaryPassword) {
      window.alert(t("temporaryPassword", { password: result.temporaryPassword }));
    }
    setMessage(result.ok ? t("passwordReset") : result.error ?? t("resetFailed"));
  };

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      id: "email",
      header: t("user"),
      sortable: true,
      cell: (user) => (
        <div>
          <div className="font-medium">{user.email}</div>
          <div className="text-xs text-muted-foreground">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") || t("noName")}
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: t("role"),
      sortable: true,
      // Основатель неприкосновенен: вместо селекта — бейдж. Сервер всё равно
      // откажет (founderInvulnerable), но и в интерфейсе соблазна быть не
      // должно. Остальным: USER → MANAGER → ADMIN (назначение менеджером —
      // просто выбор роли MANAGER).
      cell: (user) =>
        user.role === "FOUNDER" ? (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-300">
            {t("roleFounder")}
          </Badge>
        ) : (
          <Select
            value={user.role}
            onValueChange={(value) => changeRole(user.id, value as "USER" | "MANAGER" | "ADMIN")}
            disabled={pending === user.id}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">{t("roleUser")}</SelectItem>
              <SelectItem value="MANAGER">{t("roleManager")}</SelectItem>
              <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
            </SelectContent>
          </Select>
        ),
    },
    {
      id: "status",
      header: tc("status"),
      sortable: true,
      value: (user) => (user.isBlocked ? "Blocked" : "Active"),
      cell: (user) =>
        user.isBlocked ? (
          <Badge variant="outline" className="border-red-500/35 bg-red-500/15 text-red-300">
            {t("blocked")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("active")}</Badge>
        ),
    },
    {
      id: "createdAt",
      header: t("registered"),
      sortable: true,
      value: (user) => user.createdAt,
      cell: (user) => (
        <span className="text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="mt-8 space-y-4">
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <AdminDataTable
        data={users}
        columns={columns}
        rowId={(user) => user.id}
        rowLabel={(user) => user.email}
        variant="bordered"
        searchable
        searchPlaceholder={t("searchByEmailOrName")}
        searchText={(user) => `${user.email} ${user.firstName ?? ""} ${user.lastName ?? ""}`}
        defaultSort={{ columnId: "createdAt", direction: "desc" }}
        // У основателя действий нет: его нельзя заблокировать и сбросить ему
        // пароль из админки (сервер дублирует отказ).
        rowActions={(user) =>
          user.role === "FOUNDER" ? (
            <span className="px-2 text-xs text-muted-foreground" title={t("founderProtected")}>
              {t("founderProtected")}
            </span>
          ) : (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => block(user)}
              disabled={pending === user.id}
              title={user.isBlocked ? t("unlock") : t("block")}
            >
              {user.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reset(user.id)}
              disabled={pending === user.id}
              title={t("resetPassword")}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </div>
        )}
        // The action history used to be an inline panel toggled by an eye button.
        // Spectrum's disclosure panel gives it a proper row affordance and keeps
        // only one open at a time.
        renderDetail={(user) => (
          <div className="p-3">
            <p className="font-medium">{t("actionHistory")}</p>
            {user.activities.length ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {user.activities.map((activity) => (
                  <li key={activity.id}>
                    {activity.action} · {activity.title} ·{" "}
                    {new Date(activity.createdAt).toLocaleString("en-GB")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("noActionsRecorded")}</p>
            )}
          </div>
        )}
        emptyState={
          <p className="p-8 text-center text-sm text-muted-foreground">{t("noUsersMatch")}</p>
        }
      />
    </div>
  );
}
