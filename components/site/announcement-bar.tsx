"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export const ANNOUNCEMENT_BAR_HEIGHT = 32;
export const ANNOUNCEMENT_DISMISSED_KEY = "pip-announcement-dismissed";
export const ANNOUNCEMENT_VISIBILITY_EVENT = "pip-announcement-visibility-change";

type AnnouncementVisibilityDetail = { visible: boolean };

function broadcastVisibility(visible: boolean) {
  window.dispatchEvent(
    new CustomEvent<AnnouncementVisibilityDetail>(ANNOUNCEMENT_VISIBILITY_EVENT, {
      detail: { visible },
    }),
  );
}

/** A dismissible, persistent announcement strip above the site navigation. */
export function AnnouncementBar() {
  const t = useTranslations("announcement");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === "true";
    } catch {
      // Storage may be disabled; the bar still works for the current session.
    }

    setVisible(!dismissed);
    if (dismissed) broadcastVisibility(false);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, "true");
    } catch {
      // Persist when possible; always let the user dismiss it for this visit.
    }

    setVisible(false);
    broadcastVisibility(false);
  };

  if (!visible) return null;

  return (
    <div className="relative z-50 flex h-8 items-center justify-center bg-[#052B42] px-10 text-white">
      <p className="max-w-full truncate text-center font-body text-[11px] font-medium leading-none sm:text-xs">
        {t("message")}
      </p>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={dismiss}
        className="font-medium absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}
