"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

import { loginUser, registerUser } from "@/app/actions/auth";
import type { AuthActionResult } from "@/app/actions/auth";
import { getMfaPasskeyOptions } from "@/app/actions/mfa";
import { BrandMark } from "@/components/site/logo";
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
    const destination = result.mfaSetupRequired
      ? result.redirectTo || "/profile?mfa=required"
      : callbackUrl ||
        result.redirectTo ||
        (isLogin && adminMode ? "/admin" : "/cart");
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
    <section className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-background px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="mx-auto inline-flex items-center justify-center rounded-lg p-1.5 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BrandMark className="h-9" label="Plus In Plus" />
          </Link>
          <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">
            {isLogin ? t("login") : t("register")}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
            {isLogin ? t("loginPageDescription") : t("registerPageDescription")}
          </p>
        </div>

        <div className="mt-8 rounded-lg bg-muted p-6 sm:p-8">
          <form
            aria-label={isLogin ? t("login") : t("register")}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {!isLogin && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-first-name">{t("firstName")}</Label>
                  <Input
                    id="auth-first-name"
                    name="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder={t("firstNamePlaceholder")}
                    className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-last-name">{t("lastName")}</Label>
                  <Input
                    id="auth-last-name"
                    name="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder={t("lastNamePlaceholder")}
                    className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
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
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
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
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
                    required
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-confirm-password">{t("confirmPassword")}</Label>
                    <Input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••"
                      className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
                      required
                    />
                  </div>
                )}

                {isLogin && (
                  <div
                    className={`flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors duration-200 ${
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
                    className="h-11 rounded-md border-transparent bg-white px-3 text-[#171717] placeholder:text-neutral-500"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {mfaChallenge.hasTotp ? t("mfaCodeHelp") : t("passkeyOrBackupHelp")}
                  </p>
                </div>
                {mfaChallenge.hasPasskeys ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handlePasskey}
                  >
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
                className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-md"
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

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? (
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="rounded-sm underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("noAccount")}
            </button>
          ) : (
            <p>
              {t("haveAccount")}{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="rounded-sm text-foreground underline-offset-4 transition-colors duration-200 hover:text-primary hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("login")}
              </button>
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export { Signup10 };
