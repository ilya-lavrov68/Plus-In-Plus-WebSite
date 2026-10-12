"use client";

import { useState } from "react";
import { Eye, KeyRound, Lock, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";

import { resetUserPassword, toggleUserBlocked, updateUserRole } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const visible = users.filter((user) => `${user.email} ${user.firstName ?? ""} ${user.lastName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const changeRole = async (id: string, role: "USER" | "ADMIN") => {
    setPending(id); setMessage(null);
    const result = await updateUserRole(id, role);
    setPending(null); setMessage(result.ok ? t("roleUpdated") : result.error ?? t("roleUpdateFailed"));
    if (result.ok) window.location.reload();
  };
  const block = async (user: AdminUserRow) => {
    setPending(user.id); setMessage(null);
    const result = await toggleUserBlocked(user.id, !user.isBlocked);
    setPending(null); setMessage(result.ok ? (user.isBlocked ? t("userUnlocked") : t("userBlocked")) : result.error ?? t("statusUpdateFailed"));
    if (result.ok) window.location.reload();
  };
  const reset = async (id: string) => {
    if (!window.confirm(t("confirmResetPassword"))) return;
    setPending(id); setMessage(null);
    const result = await resetUserPassword(id);
    setPending(null);
    if (result.ok && result.temporaryPassword) window.alert(t("temporaryPassword", { password: result.temporaryPassword }));
    setMessage(result.ok ? t("passwordReset") : result.error ?? t("resetFailed"));
  };

  return (
    <div className="mt-8 space-y-4">
      <label className="relative block max-w-xl"><span className="sr-only">{t("searchUsers")}</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchByEmailOrName")} /></label>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[920px] text-sm"><thead className="bg-muted/40 text-left"><tr className="border-b border-border"><th className="px-4 py-3">{t("user")}</th><th className="px-4 py-3">{t("role")}</th><th className="px-4 py-3">{tc("status")}</th><th className="px-4 py-3">{t("registered")}</th><th className="px-4 py-3 text-right">{tc("actions")}</th></tr></thead><tbody>
        {visible.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><div className="font-medium">{user.email}</div><div className="text-xs text-muted-foreground">{[user.firstName, user.lastName].filter(Boolean).join(" ") || t("noName")}</div></td><td className="px-4 py-3"><Select value={user.role} onValueChange={(value) => changeRole(user.id, value as "USER" | "ADMIN")} disabled={pending === user.id}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER">USER</SelectItem><SelectItem value="ADMIN">ADMIN</SelectItem></SelectContent></Select></td><td className="px-4 py-3">{user.isBlocked ? <Badge variant="outline" className="border-red-300 text-red-700">{t("blocked")}</Badge> : <Badge variant="secondary">{t("active")}</Badge>}</td><td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("en-GB")}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => block(user)} disabled={pending === user.id} title={user.isBlocked ? t("unlock") : t("block")}>{user.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</Button><Button type="button" variant="ghost" size="sm" onClick={() => reset(user.id)} disabled={pending === user.id} title={t("resetPassword")}><KeyRound className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(open === user.id ? null : user.id)} title={t("viewHistory")}><Eye className="h-4 w-4" /></Button></div>{open === user.id ? <div className="mt-3 rounded-lg bg-muted/40 p-3 text-left"><p className="font-medium">{t("actionHistory")}</p>{user.activities.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{user.activities.map((activity) => <li key={activity.id}>{activity.action} · {activity.title} · {new Date(activity.createdAt).toLocaleString("en-GB")}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{t("noActionsRecorded")}</p>}</div> : null}</td></tr>)}
      </tbody></table>{!visible.length ? <p className="p-8 text-center text-sm text-muted-foreground">{t("noUsersMatch")}</p> : null}</div>
    </div>
  );
}
