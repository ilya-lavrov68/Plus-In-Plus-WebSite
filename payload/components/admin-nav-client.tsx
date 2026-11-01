"use client";

import { getTranslation } from "@payloadcms/translations";
import {
  AnimateHeight,
  Link,
  useConfig,
  useNav,
  usePreferences,
  useTranslation,
} from "@payloadcms/ui";
import type { NavGroupType } from "@payloadcms/ui/shared";
import {
  ActivityIcon,
  BookTextIcon,
  BoxIcon,
  BriefcaseBusinessIcon,
  CartIcon,
  ChartLineIcon,
  ChevronDownIcon,
  CreditCardIcon,
  EyeIcon,
  GalleryVerticalEndIcon,
  HistoryIcon,
  LayoutGridIcon,
  ReceiptTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-animated";
import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { PREFERENCE_KEYS, formatAdminURL } from "payload/shared";
import { useId, useState } from "react";

import {
  AnimatedIcon,
  type AnimatedIconComponent,
} from "@/components/ui/animated-icon";

export interface AdminNavPreferences {
  groups?: Record<string, { open?: boolean }>;
}

const ENTITY_ICONS: Record<string, AnimatedIconComponent> = {
  accounts: UsersIcon,
  services: BriefcaseBusinessIcon,
  products: BoxIcon,
  posts: BookTextIcon,
  media: GalleryVerticalEndIcon,
  story: HistoryIcon,
  orders: ReceiptTextIcon,
  payments: CreditCardIcon,
  "activity-logs": ActivityIcon,
  "page-views": EyeIcon,
  "site-settings": SlidersHorizontalIcon,
};

function groupIcon(group: NavGroupType): AnimatedIconComponent {
  const slugs = new Set(group.entities.map((entity) => entity.slug));
  if (slugs.has("accounts")) return UsersIcon;
  if (slugs.has("orders") || slugs.has("products") || slugs.has("payments")) return CartIcon;
  if (slugs.has("activity-logs") || slugs.has("page-views")) return ChartLineIcon;
  if (slugs.has("site-settings")) return SettingsIcon;
  if (slugs.has("posts") || slugs.has("media") || slugs.has("services")) return BookTextIcon;
  return LayoutGridIcon;
}

function AdminNavGroup({
  group,
  preferences,
}: {
  group: NavGroupType;
  preferences?: AdminNavPreferences["groups"];
}) {
  const { label } = group;
  const initiallyOpen = preferences?.[label]?.open;
  const [collapsed, setCollapsed] = useState(
    typeof initiallyOpen === "boolean" ? !initiallyOpen : false,
  );
  const [animate, setAnimate] = useState(false);
  const pathname = usePathname();
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const { setPreference } = usePreferences();
  const { navOpen } = useNav();
  const reducedMotion = useReducedMotion();
  const contentId = useId();
  const adminRoute = config.routes.admin;
  const GroupIcon = groupIcon(group);

  const toggleCollapsed = () => {
    const open = collapsed;
    setAnimate(true);
    void setPreference(
      PREFERENCE_KEYS.NAV,
      { groups: { [label]: { open } } },
      true,
    );
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={`nav-group pip-admin-nav-group${collapsed ? " nav-group--collapsed" : ""}`}
    >
      <button
        type="button"
        className={`nav-group__toggle pip-admin-nav-group__toggle nav-group__toggle--${collapsed ? "collapsed" : "open"}`}
        aria-controls={contentId}
        aria-expanded={!collapsed}
        data-pip-icon-trigger
        onClick={toggleCollapsed}
        tabIndex={navOpen ? 0 : -1}
      >
        <span className="nav-group__label pip-admin-nav-group__label">
          <AnimatedIcon
            icon={GroupIcon}
            size={21}
            className="pip-admin-nav-icon"
            interaction="press"
          />
          <span>{label}</span>
        </span>
        <span
          className={`nav-group__indicator pip-admin-nav-group__indicator${collapsed ? "" : " pip-admin-nav-group__indicator--open"}`}
        >
          <AnimatedIcon icon={ChevronDownIcon} size={18} interaction="press" />
        </span>
      </button>
      <AnimateHeight
        id={contentId}
        duration={animate && !reducedMotion ? 200 : 0}
        height={collapsed ? 0 : "auto"}
      >
        <div className="nav-group__content pip-admin-nav-group__content">
          {group.entities.map((entity) => {
            const isCollection = entity.type === "collections";
            const href = formatAdminURL({
              adminRoute,
              path: isCollection
                ? `/collections/${entity.slug}`
                : `/globals/${entity.slug}`,
            });
            const id = isCollection ? `nav-${entity.slug}` : `nav-global-${entity.slug}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const EntityIcon = ENTITY_ICONS[entity.slug] ?? LayoutGridIcon;

            return (
              <Link
                key={id}
                id={id}
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`nav__link pip-admin-nav__link${active ? " pip-admin-nav__link--active" : ""}`}
                data-pip-icon-trigger
                tabIndex={navOpen ? 0 : -1}
              >
                {active ? <span className="nav__link-indicator" aria-hidden="true" /> : null}
                <AnimatedIcon
                  icon={EntityIcon}
                  size={19}
                  className="pip-admin-nav-icon"
                  interaction="press"
                />
                <span className="nav__link-label">{getTranslation(entity.label, i18n)}</span>
              </Link>
            );
          })}
        </div>
      </AnimateHeight>
    </div>
  );
}

export function AdminNavClient({
  groups,
  navPreferences,
}: {
  groups: NavGroupType[];
  navPreferences: AdminNavPreferences | null;
}) {
  return groups.map((group) => (
    <AdminNavGroup
      key={group.label}
      group={group}
      preferences={navPreferences?.groups}
    />
  ));
}
