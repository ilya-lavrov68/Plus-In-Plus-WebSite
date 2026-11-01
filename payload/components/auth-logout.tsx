"use client";

import { useTranslation } from "@payloadcms/ui";
import { LogoutIcon } from "lucide-animated";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { AnimatedIcon } from "@/components/ui/animated-icon";

export function AuthLogout({ tabIndex = 0 }: { tabIndex?: number }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const label = t("authentication:logOut");

  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={pending}
      className="nav__log-out pip-admin-logout"
      data-pip-icon-trigger
      disabled={pending}
      title={label}
      tabIndex={tabIndex}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/" });
      }}
    >
      <AnimatedIcon icon={LogoutIcon} size={20} />
      <span>{label}</span>
    </button>
  );
}
