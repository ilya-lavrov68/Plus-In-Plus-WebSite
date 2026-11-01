"use client";

import { Button, useDocumentInfo, useTranslation } from "@payloadcms/ui";
import { useState } from "react";

import { resetUserPassword } from "@/app/actions/account";

export function ResetPasswordButton() {
  const { id } = useDocumentInfo();
  const { i18n } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const ru = i18n.language === "ru";

  if (!id || id === "create") return null;

  return (
    <div className="pip-reset-password">
      <Button
        type="button"
        buttonStyle="secondary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(ru
            ? "Сбросить пароль? Все активные сессии пользователя будут отозваны."
            : "Reset the password? All active user sessions will be revoked.")) return;
          setPending(true);
          setError("");
          setTemporaryPassword("");
          void resetUserPassword(String(id)).then((result) => {
            if (!result.ok) setError(result.error ?? (ru ? "Не удалось сбросить пароль." : "Password reset failed."));
            else setTemporaryPassword(result.temporaryPassword ?? "");
          }).catch(() => {
            setError(ru ? "Не удалось сбросить пароль." : "Password reset failed.");
          }).finally(() => setPending(false));
        }}
      >
        {pending
          ? (ru ? "Сбрасываем…" : "Resetting…")
          : (ru ? "Сбросить пароль" : "Reset password")}
      </Button>
      {error ? <p className="pip-admin-error" role="alert">{error}</p> : null}
      {temporaryPassword ? (
        <p className="pip-temporary-password" aria-live="polite">
          {ru ? "Временный пароль показан один раз:" : "Temporary password, shown once:"}{" "}
          <code>{temporaryPassword}</code>
        </p>
      ) : null}
    </div>
  );
}
