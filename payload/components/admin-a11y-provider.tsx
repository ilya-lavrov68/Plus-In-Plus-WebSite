"use client";

import { useTranslation } from "@payloadcms/ui";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

/**
 * Payload 3.92 dashboard ReactSelect не пробрасывает accessible name в input,
 * а его декоративная кнопка-шеврон с aria-hidden остаётся в tab-order.
 * Основной combobox сохраняет клавиатурное управление; дублирующий шеврон — нет.
 */
export function AdminA11yProvider({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    if (pathname !== "/admin") return;

    const label = t("general:dashboard");
    const enhanceDashboardSelect = () => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        '.dashboard-breadcrumb-select input[role="combobox"]',
      );
      const indicators = document.querySelectorAll<HTMLButtonElement>(
        ".dashboard-breadcrumb-select .dropdown-indicator",
      );
      for (const input of inputs) {
        if (input.getAttribute("aria-label") !== label) {
          input.setAttribute("aria-label", label);
        }
      }
      for (const indicator of indicators) indicator.tabIndex = -1;
    };

    enhanceDashboardSelect();
    const observer = new MutationObserver(enhanceDashboardSelect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, t]);

  return children;
}
