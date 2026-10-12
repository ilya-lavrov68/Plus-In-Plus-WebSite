"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowUpRight, LogOut, Pencil, ShieldCheck, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { loginUser, logout, registerUser, updateUserProfile } from "@/app/actions/auth";
import type { AuthActionResult } from "@/app/actions/auth";
import { UserAvatar } from "@/components/site/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IMAGE_ACCEPT, MAX_AVATAR_BYTES } from "@/lib/upload-policy";
import { profileName, type UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</p> : null;
}

function ProfilePanel({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const { update } = useSession();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateUserProfile(formData);
      if (!result.ok) { setError(result.error ?? t("saveFailed")); return; }
      // Fetch the DB-backed session. No client-supplied id, role or profile claims.
      const refreshed = await update();
      if (!refreshed?.user) { setError(t("saveFailedReload")); return; }
      setEditing(false);
      setFilename(null);
      setNotice(t("profileUpdated"));
      router.refresh();
    } catch {
      setError(t("saveFailedRetry"));
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await logout();
      if (!result.ok) { setError(result.error ?? t("logoutFailed")); return; }
      // Clear Auth.js's client cache and broadcast the server-side logout to other tabs.
      await signOut({ redirect: false, redirectTo: "/" });
      onClose();
      if (pathname.startsWith("/admin")) router.replace("/");
      router.refresh();
    } catch {
      setError(t("logoutRetry"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold text-[#052B42]">{profileName(user) || user.email}</p>
          <p className="break-all text-sm text-[#052B42]">{user.email}</p>
          {user.role === "ADMIN" ? <p className="mt-1 text-xs font-medium text-[#397248]">{t("adminSession")}</p> : null}
        </div>
      </div>

      {editing ? (
        <form aria-label={t("editProfile")} onSubmit={handleSave}>
          <fieldset disabled={pending} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">{tc("firstName")}</Label>
                <Input id="profile-first-name" name="firstName" autoComplete="given-name" maxLength={80} defaultValue={user.firstName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last-name">{tc("lastName")}</Label>
                <Input id="profile-last-name" name="lastName" autoComplete="family-name" maxLength={80} defaultValue={user.lastName ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar" className="inline-flex items-center gap-2"><Upload aria-hidden="true" className="h-4 w-4" />{tc("avatar")}</Label>
              <Input
                id="profile-avatar" name="avatar" type="file" accept={IMAGE_ACCEPT} aria-describedby="avatar-help"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setError(null);
                  if (file && file.size > MAX_AVATAR_BYTES) {
                    event.target.value = "";
                    setFilename(null);
                    setError(t("avatarTooLarge"));
                    return;
                  }
                  setFilename(file?.name ?? null);
                }}
              />
              <p id="avatar-help" className="text-xs leading-relaxed text-[#052B42]">
                {t("avatarHelp")}
                {filename ? ` ${t("avatarSelected", { name: filename })}` : ""}
              </p>
            </div>
            <FormError message={error} />
            <div className="flex gap-3">
              <Button type="submit" className="flex-1">{pending ? tc("saving") : tc("save")}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(null); setFilename(null); }}>{tc("cancel")}</Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="space-y-3">
          {notice ? <p role="status" className="text-sm text-[#397248]">{notice}</p> : null}
          <FormError message={error} />
          <Button type="button" variant="outline" className="w-full gap-2" disabled={pending} onClick={() => { setEditing(true); setError(null); setNotice(null); }}>
            <Pencil aria-hidden="true" className="h-4 w-4" />{t("editProfile")}
          </Button>
          {user.role === "ADMIN" ? (
            <Link href="/admin/dashboard" onClick={onClose} className="flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-[#052B42] underline-offset-4 hover:underline">
              {t("adminDashboard")}<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
          <Button type="button" variant="ghost" className="w-full gap-2" disabled={pending} onClick={handleLogout}>
            <LogOut aria-hidden="true" className="h-4 w-4" />{pending ? t("loggingOut") : t("logout")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** One dialog for authentication, profile management and logout. */
export function AccountModal({ open, onOpenChange }: AccountModalProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [adminMode, setAdminMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchTab(value: string) {
    setTab(value === "register" ? "register" : "login");
    setAdminMode(false);
    setError(null);
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setAdminMode(false);
      setError(null);
      setTab("login");
    }
    onOpenChange(value);
  }

  /**
   * Admin logins go straight to the dashboard; a regular login or a registration
   * closes the modal and refreshes the session so the header shows the avatar.
   */
  async function finishLogin(result: AuthActionResult) {
    const refreshed = await update();
    if (!refreshed?.user) { setError(t("sessionRefreshFailed")); return; }
    setAdminMode(false);
    if (result.isAdmin && result.redirectTo) {
      onOpenChange(false);
      router.push(result.redirectTo);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      const result = await loginUser({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), adminMode });
      if (!result.ok) { setError(result.error ?? t("loginFailed")); return; }
      await finishLogin(result);
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    setError(null);
    if (password !== confirmPassword) { setError(t("passwordsDoNotMatch")); return; }
    setPending(true);
    try {
      const result = await registerUser({
        firstName: String(data.get("firstName") ?? ""), lastName: String(data.get("lastName") ?? ""),
        email, password, confirmPassword,
      });
      if (!result.ok) {
        if (result.accountCreated) { switchTab("login"); setLoginEmail(email); }
        setError(result.error ?? t("registerFailed"));
        return;
      }
      // Registration logs the new account in, so it closes the modal like a login.
      await finishLogin(result);
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100vw_-_2rem)] overflow-y-auto rounded-xl transition-none sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("account-trigger")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{session?.user ? t("yourAccount") : t("welcome")}</DialogTitle>
          <DialogDescription>
            {session?.user ? t("manageProfile") : t("joinCommunity")}
          </DialogDescription>
        </DialogHeader>

        {session?.user ? <ProfilePanel user={session.user} onClose={() => onOpenChange(false)} /> : status === "loading" ? (
          <p role="status" className="py-8 text-center text-sm text-[#052B42]">{t("loadingAccount")}</p>
        ) : (
          <Tabs value={tab} onValueChange={switchTab}>
            <TabsList className="mb-3 grid w-full grid-cols-2">
              <TabsTrigger value="login" disabled={pending}>{t("login")}</TabsTrigger>
              <TabsTrigger value="register" disabled={pending}>{t("register")}</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form aria-label={t("login")} onSubmit={handleLogin}>
                <fieldset disabled={pending} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("email")}</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={loginEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t("password")}</Label>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={72} />
                  </div>
                  <div className={cn("flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors", adminMode ? "border-[#397248] bg-green-50" : "border-border")}>
                    <div>
                      <Label htmlFor="admin-mode" className="flex cursor-pointer items-center gap-2"><ShieldCheck aria-hidden="true" className="h-4 w-4" />{t("adminMode")}</Label>
                      <p id="admin-mode-help" className="mt-1 text-xs text-[#052B42]">{t("adminModeHelp")}</p>
                    </div>
                    <Switch id="admin-mode" aria-describedby="admin-mode-help" checked={adminMode} onCheckedChange={(value) => { setAdminMode(value); setError(null); }} disabled={pending} />
                  </div>
                  <FormError message={error} />
                  <Button type="submit" className="w-full">{pending ? t("signingIn") : t("loginButton")}</Button>
                  <button type="button" className="font-medium w-full rounded text-sm text-[#052B42] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => switchTab("register")}>
                    {t("noAccount")}
                  </button>
                </fieldset>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form aria-label={t("register")} onSubmit={handleRegister}>
                <fieldset disabled={pending} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-first-name">{t("firstName")}</Label>
                      <Input id="register-first-name" name="firstName" autoComplete="given-name" required maxLength={80} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-last-name">{t("lastName")}</Label>
                      <Input id="register-last-name" name="lastName" autoComplete="family-name" required maxLength={80} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t("email")}</Label>
                    <Input id="register-email" name="email" type="email" autoComplete="email" required maxLength={254} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t("password")}</Label>
                    <Input id="register-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} aria-describedby="password-help" />
                    <p id="password-help" className="text-xs text-[#052B42]">{t("passwordHelp")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">{t("confirmPassword")}</Label>
                    <Input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} />
                  </div>
                  <FormError message={error} />
                  <Button type="submit" className="w-full">{pending ? t("creatingAccount") : t("registerButton")}</Button>
                </fieldset>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
