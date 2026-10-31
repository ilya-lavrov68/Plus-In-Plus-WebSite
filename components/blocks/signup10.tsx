"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type FormEvent, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { loginUser, registerUser } from "@/app/actions/auth";
import type { AuthActionResult } from "@/app/actions/auth";
import { getMfaPasskeyOptions } from "@/app/actions/mfa";
import { BrandMark } from "@/components/site/logo";
import { MediaPlaceholder } from "@/components/site/media-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface Signup10Props {
  defaultMode?: "login" | "register";
  mode?: "login" | "register";
  callbackUrl?: string;
  defaultAdminMode?: boolean;
}

const Signup10 = ({
  defaultMode = "login",
  mode,
  callbackUrl,
  defaultAdminMode = false,
}: Signup10Props) => {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const t = useTranslations("auth");
  const [activeMode, setActiveMode] = useState<"login" | "register">(
    mode ?? defaultMode
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminMode, setAdminMode] = useState(defaultAdminMode);
  const [mfaChallenge, setMfaChallenge] = useState<{
    id: string;
    secret: string;
    hasTotp: boolean;
    hasPasskeys: boolean;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = activeMode === "login";

  const switchMode = (nextMode: "login" | "register") => {
    setActiveMode(nextMode);
    setMfaChallenge(null);
    setMfaCode("");
    setError(null);
    if (nextMode === "register") {
      setAdminMode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isLogin) {
      if (password.length < 12) {
        setError(t("passwordTooShort"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("passwordsDoNotMatch"));
        return;
      }
    }

    setLoading(true);
    try {
      const result = isLogin
        ? mfaChallenge
          ? await loginUser({
              pendingLoginId: mfaChallenge.id,
              pendingLoginSecret: mfaChallenge.secret,
              mfaCode,
              adminMode,
            })
          : await loginUser({
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
      await processResult(result);
    } catch {
      setError(t("genericError"));
      setLoading(false);
    }
  }

  async function processResult(result: AuthActionResult) {
    if (result.mfaRequired && result.pendingLoginId && result.pendingLoginSecret) {
      setMfaChallenge({
        id: result.pendingLoginId,
        secret: result.pendingLoginSecret,
        hasTotp: result.hasTotp === true,
        hasPasskeys: result.hasPasskeys === true,
      });
      setMfaCode("");
      setError(result.error ?? null);
      setLoading(false);
      return;
    }
    if (!result.ok) {
      setError(result.error || (isLogin ? t("loginError") : t("registerError")));
      setLoading(false);
      return;
    }

    await updateSession().catch(() => null);
    const destination =
      result.redirectTo ||
      callbackUrl ||
      (isLogin && adminMode ? "/admin/dashboard" : "/cart");
    setMfaChallenge(null);
    setMfaCode("");
    router.push(destination);
    router.refresh();
  }

  async function handlePasskey() {
    if (!mfaChallenge || loading) return;
    setError(null);
    setLoading(true);
    try {
      const options = await getMfaPasskeyOptions(mfaChallenge.id, mfaChallenge.secret);
      if (!options.ok) {
        setError(options.error ?? t("passkeyUnavailable"));
        setLoading(false);
        return;
      }
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const assertion = await startAuthentication({ optionsJSON: options.options });
      const result = await loginUser({
        pendingLoginId: mfaChallenge.id,
        pendingLoginSecret: mfaChallenge.secret,
        webAuthnResponse: assertion,
        adminMode,
      });
      await processResult(result);
    } catch {
      setError(t("passkeyStartFailed"));
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
                className="mx-auto inline-flex items-center justify-center rounded-xl p-1.5 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <BrandMark className="h-9" label="Plus In Plus" />
              </Link>

              <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight md:text-4xl">
                {isLogin ? t("login") : t("register")}
              </h1>
              <p className="mx-auto mt-2.5 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                {isLogin
                  ? t("loginPageDescription")
                  : t("registerPageDescription")}
              </p>
            </div>

            <div
              role="tablist"
              aria-label={t("authenticationMode")}
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
                    className="absolute inset-0 rounded-full bg-primary "
                  />
                )}
                <span className="relative z-10">{t("login")}</span>
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
                    className="absolute inset-0 rounded-full bg-primary "
                  />
                )}
                <span className="relative z-10">{t("register")}</span>
              </button>
            </div>

            <form
              aria-label={isLogin ? t("login") : t("register")}
              onSubmit={handleSubmit}
              className="mt-7 space-y-4"
            >
              {!isLogin && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-first-name">{t("firstName")}</Label>
                    <Input
                      id="auth-first-name"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t("firstNamePlaceholder")}
                      className="h-12 rounded-full px-5"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-last-name">{t("lastName")}</Label>
                    <Input
                      id="auth-last-name"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t("lastNamePlaceholder")}
                      className="h-12 rounded-full px-5"
                      required
                    />
                  </div>
                </div>
              )}

              {!mfaChallenge ? (
                <>
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">{t("email")}</Label>
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
                <Label htmlFor="auth-password">{t("password")}</Label>
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
                    {t("confirmPassword")}
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
                    {t("adminMode")}
                  </Label>
                  <Switch
                    id="auth-admin-mode"
                    checked={adminMode}
                    onCheckedChange={setAdminMode}
                  />
                </div>
              )}
                </>
              ) : null}

              {isLogin && mfaChallenge ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-mfa-code">{t("mfaCode")}</Label>
                    <Input
                      id="auth-mfa-code"
                      name="mfaCode"
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      required={mfaChallenge.hasTotp}
                      maxLength={64}
                      className="h-12 rounded-full px-5"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mfaChallenge.hasTotp ? t("mfaCodeHelp") : t("passkeyOrBackupHelp")}
                    </p>
                  </div>
                  {mfaChallenge.hasPasskeys ? (
                    <Button type="button" variant="outline" className="w-full" onClick={handlePasskey}>
                      {t("usePasskey")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setMfaChallenge(null);
                      setMfaCode("");
                      setError(null);
                    }}
                  >
                    {t("mfaBack")}
                  </Button>
                </>
              ) : null}

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
                    ? t("signingIn")
                    : t("creatingAccount")
                  : isLogin
                    ? mfaChallenge
                      ? t("verifyMfa")
                      : t("loginButton")
                    : t("registerButton")}
              </Button>
            </form>
          </div>
        </div>

        <div className="relative hidden overflow-hidden border-l-0 bg-muted lg:block">
          <MediaPlaceholder
            className="absolute inset-0"
            markClassName="h-20 opacity-20"
          />
          <div className="absolute right-8 bottom-8 left-8 max-w-lg rounded-2xl bg-slate-950/35 p-6 backdrop-blur-2xl">
            <p className="text-xl leading-snug font-medium text-white">
              {t("studioPitch")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup10 };
