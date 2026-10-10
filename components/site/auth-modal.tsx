"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Authorization dialog with "Log in" and "Register" tabs.
 *
 * - Log in: ADMIN → redirect to /admin/dashboard, USER → close the modal.
 * - Register: creates a USER account and logs in automatically.
 */
export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const router = useRouter();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: loginEmail,
        password: loginPassword,
      });
      if (!result?.ok || result.error) {
        setError("Invalid email or password.");
        return;
      }

      const session = await getSession();
      if (!session?.user) {
        setError("Unable to verify your session. Try again.");
        return;
      }
      onOpenChange(false);
      if (session?.user?.role === "ADMIN") {
        router.push("/admin/dashboard");
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      // Server action: creates a USER with a bcrypt-hashed password.
      const { registerUser } = await import("@/app/actions/auth");
      const registration = await registerUser({
        email: registerEmail,
        password: registerPassword,
      });
      if (!registration.ok) {
        setError(registration.error ?? "Registration failed.");
        return;
      }

      // Automatic login as USER after a successful registration.
      const result = await signIn("credentials", {
        redirect: false,
        email: registerEmail,
        password: registerPassword,
      });
      if (!result?.ok || result.error) {
        setTab("login");
        setError("Account created — please log in.");
        return;
      }

      const session = await getSession();
      if (!session?.user) {
        setTab("login");
        setError("Account created — please log in.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Plus In Plus</DialogTitle>
          <DialogDescription>
            Log in to your account or register a new one to place orders.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as "login" | "register");
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in…" : "Log in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={72}
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 12 characters. Passwords are limited to 72 UTF-8 bytes.
                </p>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account…" : "Register"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
