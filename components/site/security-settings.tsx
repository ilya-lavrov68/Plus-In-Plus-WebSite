"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import {
  beginPasskeyRegistration,
  beginTotpSetup,
  enableTotp,
  finishPasskeyRegistration,
  regenerateBackupCodes,
  removePasskey,
} from "@/app/actions/mfa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SecuritySettingsProps {
  required: boolean;
  initialTotpEnabled: boolean;
  initialPasskeys: { id: string; name: string }[];
}

interface TotpSetupState {
  secret: string;
  qrCode: string;
  id: number;
  expiresAt: number;
}

export function SecuritySettings({ required, initialTotpEnabled, initialPasskeys }: SecuritySettingsProps) {
  const t = useTranslations("security");
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [setup, setSetup] = useState<TotpSetupState | null>(null);
  const [setupExpired, setSetupExpired] = useState(false);
  const [showInvalidTotpHelp, setShowInvalidTotpHelp] = useState(false);
  const [code, setCode] = useState("");
  const [passkeyName, setPasskeyName] = useState("My passkey");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!setup) return;
    const timer = window.setTimeout(
      () => setSetupExpired(true),
      Math.max(0, setup.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [setup]);

  async function run(action: () => Promise<void>) {
    // State disables the controls after render; the ref also closes the same-tick
    // double-click gap before React has committed that disabled state.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch {
      setError(t("operationFailed"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function showBackupCodes(codes: string[] | undefined) {
    if (codes?.length) setBackupCodes(codes);
  }

  function startTotpSetup() {
    void run(async () => {
      setShowInvalidTotpHelp(false);
      const result = await beginTotpSetup();
      if (!result.ok || !result.secret || !result.qrCode || typeof result.setupId !== "number" || typeof result.setupExpiresIn !== "number") {
        setError(result.error ?? t("operationFailed"));
        return;
      }
      setCode("");
      setSetupExpired(false);
      setSetup({
        secret: result.secret,
        qrCode: result.qrCode,
        id: result.setupId,
        expiresAt: Date.now() + result.setupExpiresIn,
      });
    });
  }

  return (
    <Card className="glass-panel mt-6 border-border bg-background/65">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("title")}</CardTitle>
          <Badge variant={totpEnabled || passkeys.length ? "secondary" : "outline"}>
            {totpEnabled || passkeys.length ? t("enabled") : t("notEnabled")}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {required && !totpEnabled && passkeys.length === 0 ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {t("requiredForStaff")}
          </p>
        ) : null}

        <section className="space-y-4" aria-labelledby="totp-heading">
          <div>
            <h3 id="totp-heading" className="text-sm font-semibold">{t("totpTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("totpDescription")}</p>
          </div>
          {totpEnabled ? (
            <Badge variant="secondary">{t("totpEnabled")}</Badge>
          ) : setup && !setupExpired ? (
            <form
              className="space-y-4"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(async () => {
                  setShowInvalidTotpHelp(false);
                  const result = await enableTotp(code, setup.id);
                  if (!result.ok) {
                    if (result.failureReason === "stale-setup") {
                      setSetup(null);
                      setSetupExpired(false);
                      setCode("");
                    } else if (result.failureReason === "invalid-code") {
                      setShowInvalidTotpHelp(true);
                    }
                    setError(result.error ?? t("operationFailed"));
                    return;
                  }
                  setTotpEnabled(true);
                  setSetup(null);
                  setCode("");
                  showBackupCodes(result.backupCodes);
                  setNotice(t("totpEnabledNotice"));
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                <Image src={setup.qrCode} alt={t("qrAlt")} width={160} height={160} unoptimized className="rounded-md bg-white p-2" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t("scanInstructions")}</p>
                  <Label htmlFor="totp-secret">{t("manualKey")}</Label>
                  <code id="totp-secret" className="block break-all rounded-md bg-secondary/60 p-3 text-sm">{setup.secret}</code>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-confirm-code">{t("sixDigitCode")}</Label>
                <Input
                  id="totp-confirm-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  maxLength={10}
                  aria-describedby={showInvalidTotpHelp ? "totp-confirm-help" : undefined}
                />
                {showInvalidTotpHelp ? (
                  <p id="totp-confirm-help" className="text-sm leading-relaxed text-muted-foreground">
                    {t("invalidTotpHelp")}
                  </p>
                ) : null}
              </div>
              <Button type="submit" disabled={pending}>{t("confirmTotp")}</Button>
            </form>
          ) : (
            <div className="space-y-3">
              {setupExpired ? (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {t("setupExpired")}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={startTotpSetup}
              >
                {setupExpired ? t("restartTotp") : t("setupTotp")}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-border/60 pt-6" aria-labelledby="passkeys-heading">
          <div>
            <h3 id="passkeys-heading" className="text-sm font-semibold">{t("passkeysTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("passkeysDescription")}</p>
          </div>
          {passkeys.length ? (
            <ul className="space-y-2">
              {passkeys.map((passkey) => (
                <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-secondary/50 p-3">
                  <span className="text-sm">{passkey.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t("confirmRemovePasskey"))) return;
                      void run(async () => {
                        const result = await removePasskey(passkey.id, password, confirmationCode);
                        if (!result.ok) {
                          setError(result.error ?? t("operationFailed"));
                          return;
                        }
                        setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
                        setPassword("");
                        setConfirmationCode("");
                        setNotice(t("passkeyRemoved"));
                      });
                    }}
                  >
                    {t("removePasskey")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t("noPasskeys")}</p>}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="passkey-name">{t("passkeyName")}</Label>
              <Input id="passkey-name" value={passkeyName} maxLength={80} onChange={(event) => setPasskeyName(event.target.value)} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void run(async () => {
                const options = await beginPasskeyRegistration();
                if (!options.ok) {
                  setError(options.error ?? t("operationFailed"));
                  return;
                }
                const { startRegistration } = await import("@simplewebauthn/browser");
                const response = await startRegistration({ optionsJSON: options.options });
                const result = await finishPasskeyRegistration(response, passkeyName);
                if (!result.ok) {
                  setError(result.error ?? t("operationFailed"));
                  return;
                }
                setPasskeys((current) => [...current, { id: response.id, name: passkeyName.trim().slice(0, 80) || "Passkey" }]);
                showBackupCodes(result.backupCodes);
                setNotice(t("passkeyAdded"));
              })}
            >
              {t("addPasskey")}
            </Button>
          </div>
        </section>

        <section className="space-y-4 border-t border-border/60 pt-6" aria-labelledby="confirmation-heading">
          <div>
            <h3 id="confirmation-heading" className="text-sm font-semibold">{t("confirmationTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("confirmationDescription")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="security-current-password">{t("currentPassword")}</Label>
              <Input id="security-current-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="security-confirmation-code">{t("confirmationCode")}</Label>
              <Input id="security-confirmation-code" autoComplete="one-time-code" value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value)} />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || (!totpEnabled && passkeys.length === 0)}
            onClick={() => {
              if (!window.confirm(t("confirmRegenerateBackupCodes"))) return;
              void run(async () => {
                const result = await regenerateBackupCodes(password, confirmationCode);
                if (!result.ok) {
                  setError(result.error ?? t("operationFailed"));
                  return;
                }
                setPassword("");
                setConfirmationCode("");
                showBackupCodes(result.backupCodes);
              });
            }}
          >
            {t("regenerateBackupCodes")}
          </Button>
        </section>

        {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-foreground">{notice}</p> : null}

        {backupCodes ? (
          <section className="space-y-4 rounded-lg border border-border bg-secondary/60 p-4" aria-labelledby="backup-codes-heading">
            <div>
              <h3 id="backup-codes-heading" className="text-sm font-semibold">{t("backupCodesTitle")}</h3>
              <p className="mt-1 text-sm text-destructive">{t("backupCodesWarning")}</p>
            </div>
            <ul className="grid gap-2 font-mono text-sm sm:grid-cols-2">
              {backupCodes.map((backupCode) => <li key={backupCode} className="rounded bg-background/60 p-2">{backupCode}</li>)}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void run(async () => {
                  await navigator.clipboard.writeText(backupCodes.join("\n"));
                  setNotice(t("copied"));
                })}
              >
                {t("copyCodes")}
              </Button>
              <Button type="button" onClick={() => setBackupCodes(null)}>{t("codesSaved")}</Button>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
