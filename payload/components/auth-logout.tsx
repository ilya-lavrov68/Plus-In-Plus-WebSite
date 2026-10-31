"use client";

import { LogOutIcon, useTranslation } from "@payloadcms/ui";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function AuthLogout({ tabIndex = 0 }: { tabIndex?: number }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const label = t("authentication:logOut");

  return (
    <button
      type="button"
      aria-label={label}
      className="nav__log-out"
      disabled={pending}
      title={label}
      tabIndex={tabIndex}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/" });
      }}
    >
      <LogOutIcon />
    </button>
  );
}
