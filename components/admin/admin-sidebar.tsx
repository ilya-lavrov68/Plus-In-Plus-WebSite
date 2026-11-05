"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  ChevronDown,
  ExternalLink,
  FileText,
  History,
  Images,
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AdminNavGroup } from "@/components/admin/admin-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useHoverMenu } from "@/components/ui/use-hover-menu";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/orders": ShoppingCart,
  "/admin/services": Boxes,
  "/admin/products": Package,
  "/admin/posts": FileText,
  "/admin/story": History,
  "/admin/media": Images,
  "/admin/accounts": Users,
  "/admin/activity": Activity,
  "/admin/settings": Settings,
};

export interface AdminSidebarProps {
  groups: AdminNavGroup[];
  labels: {
    title: string;
    navLabel: string;
    quickCreate: string;
    quickCreateHint: string;
    account: string;
    viewSite: string;
    settings: string;
    toggle: string;
  };
  quickCreateItems: { href: string; label: string }[];
  user: { email: string; roleLabel: string };
  settingsHref?: string;
}

/**
 * Панель разделов админки в духе `dashboard-01`: сворачивается до иконок,
 * на телефоне открывается отдельным sheet, состояние живёт в cookie.
 */
export function AdminSidebar({ groups, labels, quickCreateItems, user, settingsHref }: AdminSidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      aria-label={labels.navLabel}
      mobileTitle={labels.navLabel}
      mobileDescription={labels.title}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="h-auto py-2">
              <Link href="/admin">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container-high">
                  <img
                    src="/assets/logos/lnpip.svg"
                    alt=""
                    aria-hidden="true"
                    width={54}
                    height={42}
                    className="h-4 w-auto select-none"
                  />
                </span>
                <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium text-on-surface">{labels.title}</span>
                  <span className="truncate text-xs text-on-surface-variant">Plus In Plus</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <QuickCreate label={labels.quickCreate} hint={labels.quickCreateHint} items={quickCreateItems} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, index) => (
          <React.Fragment key={group.label ?? index}>
            {index > 0 ? (
              // В свёрнутой панели заголовки групп скрыты, поэтому границу
              // разделов держит служебный разделитель — иначе иконки сливаются.
              <SidebarSeparator className="mx-1 my-1 hidden group-data-[collapsible=icon]:block" />
            ) : null}
            <SidebarGroup>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = ICONS[item.href] ?? LayoutDashboard;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                          <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                            <Icon aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu
          email={user.email}
          roleLabel={user.roleLabel}
          accountLabel={labels.account}
          viewSite={labels.viewSite}
          settingsLabel={labels.settings}
          settingsHref={settingsHref}
        />
      </SidebarFooter>
      <SidebarRail label={labels.toggle} />
    </Sidebar>
  );
}

/** Меню быстрых действий: то же место, что «Quick Create» в эталоне. */
function QuickCreate({ label, hint, items }: { label: string; hint: string; items: { href: string; label: string }[] }) {
  const { open, setOpen, closeNow, hoverProps } = useHoverMenu({ openDelay: 60 });
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeNow();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeNow, open]);

  return (
    <div ref={rootRef} className="relative" {...hoverProps}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg bg-on-surface px-2 text-left text-sm font-medium text-surface transition-colors duration-200",
          "hover:bg-hover-surface hover:text-signal focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-[calc(100%+0.375rem)] left-0 z-50 w-full min-w-52 rounded-xl bg-popover/85 p-1.5 text-popover-foreground backdrop-blur-2xl"
        >
          <p className="px-2.5 pb-1 pt-1 text-[11px] text-on-surface-variant">{hint}</p>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={closeNow}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-3.5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Строка пользователя с меню: имя, роль и переходы уровня аккаунта. */
function UserMenu({
  email,
  roleLabel,
  accountLabel,
  viewSite,
  settingsLabel,
  settingsHref,
}: {
  email: string;
  roleLabel: string;
  accountLabel: string;
  viewSite: string;
  settingsLabel: string;
  settingsHref?: string;
}) {
  const { open, setOpen, closeNow, hoverProps } = useHoverMenu({ openDelay: 80 });
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeNow();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeNow, open]);

  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative" {...hoverProps}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={accountLabel}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-container-highest text-xs font-medium text-on-surface">
          {initial}
        </span>
        <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm text-on-surface" title={email}>
            {email}
          </span>
          <span className="truncate text-xs text-on-surface-variant">{roleLabel}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-on-surface-variant transition-transform duration-200 group-data-[collapsible=icon]:hidden", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={accountLabel}
          className="absolute bottom-[calc(100%+0.375rem)] left-0 z-50 w-full min-w-52 rounded-xl bg-popover/85 p-1.5 text-popover-foreground backdrop-blur-2xl"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm text-on-surface">{email}</p>
            <p className="truncate text-xs text-on-surface-variant">{roleLabel}</p>
          </div>
          <div className="my-1 h-px bg-outline-variant/60" role="presentation" />
          {settingsHref ? (
            <MenuLink href={settingsHref} label={settingsLabel} icon={Settings} onNavigate={closeNow} />
          ) : null}
          <MenuLink href="/" label={viewSite} icon={ExternalLink} onNavigate={closeNow} external />
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon: Icon,
  onNavigate,
  external = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onNavigate: () => void;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/10 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
