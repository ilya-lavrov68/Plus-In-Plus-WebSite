"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type FormEvent, useState } from "react";
import { motion } from "motion/react";

import { loginUser, registerUser } from "@/app/actions/auth";
import { BrandMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface Signup10Props {
  defaultMode?: "login" | "register";
  mode?: "login" | "register";
  callbackUrl?: string;
}

const Signup10 = ({
  defaultMode = "login",
  mode,
  callbackUrl,
}: Signup10Props) => {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [activeMode, setActiveMode] = useState<"login" | "register">(
    mode ?? defaultMode
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = activeMode === "login";

  const switchMode = (nextMode: "login" | "register") => {
    setActiveMode(nextMode);
    setError(null);
    if (nextMode === "register") {
      setAdminMode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isLogin) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const result = isLogin
        ? await loginUser({
            email: email.trim().toLowerCase(),
            password,
            adminMode,
          })
        : await registerUser({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password,
            confirmPassword,
          });

      if (!result.ok) {
        setError(
          result.error ||
            (isLogin
              ? "Invalid email or password."
              : "Could not create account. Please try again.")
        );
        setLoading(false);
        return;
      }

      await updateSession().catch(() => null);

      const destination =
        result.redirectTo ||
        callbackUrl ||
        (isLogin && adminMode ? "/admin/dashboard" : "/orders");
      router.push(destination);
      router.refresh();
    } catch {
      setError("Authentication failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <section className="min-h-[calc(100dvh-5rem)] bg-background">
      <div className="grid min-h-[calc(100dvh-5rem)] grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center px-6 py-16 sm:px-12 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-md">
            <div className="flex flex-col items-center text-center">
              <Link
                href="/"
                className="mx-auto inline-flex items-center justify-center rounded-xl p-1.5 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandMark className="h-9" label="Plus In Plus" />
              </Link>

              <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight md:text-4xl">
                {isLogin ? "Log in" : "Register"}
              </h1>
              <p className="mx-auto mt-2.5 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                {isLogin
                  ? "Sign in to manage your Plus In Plus orders and studio requests."
                  : "Create a Plus In Plus account to place orders and track your designs."}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mt-8 grid grid-cols-2 rounded-full border border-border bg-muted p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                onClick={() => switchMode("login")}
                className={`relative rounded-full py-2.5 text-center text-sm font-medium transition-colors duration-200 ${
                  isLogin
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isLogin && (
                  <motion.span
                    layoutId="signup10-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 36 }}
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  />
                )}
                <span className="relative z-10">Log in</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                onClick={() => switchMode("register")}
                className={`relative rounded-full py-2.5 text-center text-sm font-medium transition-colors duration-200 ${
                  !isLogin
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {!isLogin && (
                  <motion.span
                    layoutId="signup10-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 36 }}
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  />
                )}
                <span className="relative z-10">Register</span>
              </button>
            </div>

            <form
              aria-label={isLogin ? "Log in" : "Register"}
              onSubmit={handleSubmit}
              className="mt-7 space-y-4"
            >
              {!isLogin && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-first-name">First name</Label>
                    <Input
                      id="auth-first-name"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Alex"
                      className="h-12 rounded-full px-5"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-last-name">Last name</Label>
                    <Input
                      id="auth-last-name"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Morozov"
                      className="h-12 rounded-full px-5"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 rounded-full px-5"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-full px-5"
                  required
                />
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm-password">
                    Confirm password
                  </Label>
                  <Input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-full px-5"
                    required
                  />
                </div>
              )}

              {isLogin && (
                <div
                  className={`flex items-center justify-between rounded-full border bg-card px-5 py-3 transition-colors duration-200 ${
                    adminMode ? "border-primary" : "border-border"
                  }`}
                >
                  <Label
                    htmlFor="auth-admin-mode"
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    Admin mode
                  </Label>
                  <Switch
                    id="auth-admin-mode"
                    checked={adminMode}
                    onCheckedChange={setAdminMode}
                  />
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm text-red-300"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-14 w-full rounded-full text-base font-medium"
              >
                {loading
                  ? isLogin
                    ? "Signing in..."
                    : "Creating account..."
                  : isLogin
                    ? "Log in"
                    : "Register"}
              </Button>
            </form>
          </div>
        </div>

        <div className="relative hidden overflow-hidden border-l border-border bg-muted lg:block">
          <img
            src="/assets/shop/sign-design-2.jpg"
            alt="Plus In Plus studio work"
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
          <div className="absolute right-12 bottom-12 left-12 max-w-lg">
            <p className="text-2xl leading-snug font-medium text-white">
              Stylish, clear design—from website mockups to signage, posters,
              and event collateral.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup10 };
