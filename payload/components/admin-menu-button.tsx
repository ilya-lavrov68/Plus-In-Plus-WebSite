"use client";

import { NavToggler, useNav } from "@payloadcms/ui";
import { MenuIcon, XIcon } from "lucide-animated";

import { AnimatedIcon } from "@/components/ui/animated-icon";

export function AdminMenuButton() {
  const { navOpen } = useNav();

  return (
    <NavToggler
      className={`pip-admin-menu-button${navOpen ? " pip-admin-menu-button--open" : ""}`}
    >
      <AnimatedIcon icon={navOpen ? XIcon : MenuIcon} size={22} />
    </NavToggler>
  );
}
