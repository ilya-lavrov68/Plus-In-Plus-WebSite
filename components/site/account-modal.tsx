"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowUpRight, LogOut, Pencil, ShieldCheck, Upload } from "lucide-react";

import { loginUser, logout, registerUser, updateUserProfile } from "@/app/actions/auth";
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
      if (!result.ok) { setError(result.error ?? "Unable to save your profile."); return; }
      // Fetch the DB-backed session. No client-supplied id, role or profile claims.
      const refreshed = await update();
      if (!refreshed?.user) { setError("Profile saved. Please reload the page to refresh your session."); return; }
      setEditing(false);
      setFilename(null);
      setNotice("Profile updated.");
      router.refresh();
    } catch {
      setError("Unable to save your profile. Please try again.");
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
      if (!result.ok) { setError(result.error ?? "Unable to log out."); return; }
      // Clear Auth.js's client cache and broadcast the server-side logout to other tabs.
      await signOut({ redirect: false, redirectTo: "/" });
      if (pathname.startsWith("/admin")) { onClose(); router.replace("/"); }
      router.refresh();
    } catch {
      setError("Unable to log out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold text-[#052B42]">{profileName(user) || "Your account"}</p>
          <p className="break-all text-sm text-[#052B42]">{user.email}</p>
          {user.role === "ADMIN" ? <p className="mt-1 text-xs font-medium text-[#397248]">Admin session</p> : null}
        </div>
      </div>

      {editing ? (
        <form aria-label="Edit profile" onSubmit={handleSave}>
          <fieldset disabled={pending} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">First name</Label>
                <Input id="profile-first-name" name="firstName" autoComplete="given-name" maxLength={80} defaultValue={user.firstName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last-name">Last name</Label>
                <Input id="profile-last-name" name="lastName" autoComplete="family-name" maxLength={80} defaultValue={user.lastName ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar" className="inline-flex items-center gap-2"><Upload aria-hidden="true" className="h-4 w-4" />Avatar</Label>
              <Input
                id="profile-avatar" name="avatar" type="file" accept={IMAGE_ACCEPT} aria-describedby="avatar-help"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setError(null);
                  if (file && file.size > MAX_AVATAR_BYTES) {
                    event.target.value = "";
                    setFilename(null);
                    setError("Avatar must be 2 MB or smaller.");
                    return;
                  }
                  setFilename(file?.name ?? null);
                }}
              />
              <p id="avatar-help" className="text-xs leading-relaxed text-[#052B42]">
                PNG, JPEG, WebP, GIF or AVIF, up to 2 MB. Stored locally. Leave empty to keep your current avatar.
                {filename ? ` Selected: ${filename}` : ""}
              </p>
            </div>
            <FormError message={error} />
            <div className="flex gap-3">
              <Button type="submit" className="flex-1">{pending ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(null); setFilename(null); }}>Cancel</Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="space-y-3">
          {notice ? <p role="status" className="text-sm text-[#397248]">{notice}</p> : null}
          <FormError message={error} />
          <Button type="button" variant="outline" className="w-full gap-2" disabled={pending} onClick={() => { setEditing(true); setError(null); setNotice(null); }}>
            <Pencil aria-hidden="true" className="h-4 w-4" />Edit profile
          </Button>
          {user.role === "ADMIN" ? (
            <Link href="/admin/dashboard" onClick={onClose} className="flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-[#052B42] underline-offset-4 hover:underline">
              Admin dashboard<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
          <Button type="button" variant="ghost" className="w-full gap-2" disabled={pending} onClick={handleLogout}>
            <LogOut aria-hidden="true" className="h-4 w-4" />{pending ? "Logging out…" : "Log out"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** One dialog for authentication, profile management and logout. */
export function AccountModal({ open, onOpenChange }: AccountModalProps) {
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

  async function finishLogin(redirectTo?: "/admin/dashboard") {
    const refreshed = await update();
    if (!refreshed?.user) { setError("Unable to refresh your session. Please reload the page."); return; }
    setAdminMode(false);
    if (redirectTo) { onOpenChange(false); router.push(redirectTo); }
    // Regular login and registration keep the dialog open, now displaying the profile.
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
      if (!result.ok) { setError(result.error ?? "Unable to log in."); return; }
      await finishLogin(result.redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
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
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setPending(true);
    try {
      const result = await registerUser({
        firstName: String(data.get("firstName") ?? ""), lastName: String(data.get("lastName") ?? ""),
        email, password, confirmPassword,
      });
      if (!result.ok) {
        if (result.accountCreated) { switchTab("login"); setLoginEmail(email); }
        setError(result.error ?? "Unable to register.");
        return;
      }
      await finishLogin();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { setAdminMode(false); setError(null); } onOpenChange(value); }}>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100vw_-_2rem)] overflow-y-auto rounded-xl transition-none sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("account-trigger")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{session?.user ? "Your account" : "Welcome to Plus In Plus"}</DialogTitle>
          <DialogDescription>
            {session?.user ? "Manage your personal details and profile photo." : "Log in to your account or join the Plus In Plus community."}
          </DialogDescription>
        </DialogHeader>

        {session?.user ? <ProfilePanel user={session.user} onClose={() => onOpenChange(false)} /> : status === "loading" ? (
          <p role="status" className="py-8 text-center text-sm text-[#052B42]">Loading your account…</p>
        ) : (
          <Tabs value={tab} onValueChange={switchTab}>
            <TabsList className="mb-3 grid w-full grid-cols-2">
              <TabsTrigger value="login" disabled={pending}>Log in</TabsTrigger>
              <TabsTrigger value="register" disabled={pending}>Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form aria-label="Log in" onSubmit={handleLogin}>
                <fieldset disabled={pending} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={loginEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={72} />
                  </div>
                  <div className={cn("flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors", adminMode ? "border-[#397248] bg-green-50" : "border-border")}>
                    <div>
                      <Label htmlFor="admin-mode" className="flex cursor-pointer items-center gap-2"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Admin mode</Label>
                      <p id="admin-mode-help" className="mt-1 text-xs text-[#052B42]">For existing administrators only.</p>
                    </div>
                    <Switch id="admin-mode" aria-describedby="admin-mode-help" checked={adminMode} onCheckedChange={(value) => { setAdminMode(value); setError(null); }} disabled={pending} />
                  </div>
                  <FormError message={error} />
                  <Button type="submit" className="w-full">{pending ? "Signing in…" : "Log in"}</Button>
                  <button type="button" className="w-full rounded text-sm text-[#052B42] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => switchTab("register")}>
                    Don&apos;t have an account? Register
                  </button>
                </fieldset>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form aria-label="Register" onSubmit={handleRegister}>
                <fieldset disabled={pending} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-first-name">First name</Label>
                      <Input id="register-first-name" name="firstName" autoComplete="given-name" required maxLength={80} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-last-name">Last name</Label>
                      <Input id="register-last-name" name="lastName" autoComplete="family-name" required maxLength={80} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" name="email" type="email" autoComplete="email" required maxLength={254} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input id="register-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} aria-describedby="password-help" />
                    <p id="password-help" className="text-xs text-[#052B42]">At least 12 characters, at most 72 UTF-8 bytes.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirm password</Label>
                    <Input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} />
                  </div>
                  <FormError message={error} />
                  <Button type="submit" className="w-full">{pending ? "Creating account…" : "Register"}</Button>
                </fieldset>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
