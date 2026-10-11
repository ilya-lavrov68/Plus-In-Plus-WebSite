"use client";

import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Building,
  Building2,
  ChevronDown,
  Circle,
  Flag,
  Handshake,
  Home,
  Image,
  Megaphone,
  Menu,
  Newspaper,
  Palette,
  RectangleHorizontal,
  Send,
  ShoppingBag,
  Store,
  Tag,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useSession } from "next-auth/react";

import { AccountModal } from "@/components/site/account-modal";
import { UserAvatar } from "@/components/site/user-avatar";
import { Logo } from "@/components/site/logo";
import { HeaderButton, HeaderButtonLink } from "@/components/ui/header-button";
import { cn } from "@/lib/utils";

function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type NavigationIcon = LucideIcon | typeof YouTubeIcon;
type NavigationLink = {
  label: string;
  href: string;
  icon: NavigationIcon;
  external?: boolean;
};
type NavigationItem = { id: string; label: string; links: NavigationLink[] };

// Social profiles are placeholders until the studio confirms its handles.
const SOCIAL_LINKS: NavigationLink[] = [
  { label: "VK", href: "https://vk.com/plusinplus", icon: Circle, external: true },
  { label: "Telegram", href: "https://t.me/plusinplus", icon: Send, external: true },
  { label: "YouTube", href: "https://www.youtube.com/@plusinplus", icon: YouTubeIcon, external: true },
];

const navigation: NavigationItem[] = [
  {
    id: "for-play",
    label: "FOR PLAY",
    links: [
      { label: "Order a design", href: "/shop", icon: ShoppingBag },
      { label: "Design services", href: "/#categories", icon: Palette },
      { label: "Small designs", href: "/shop#small-designs", icon: Tag },
      { label: "Large designs", href: "/shop#large-designs", icon: Building },
    ],
  },
  {
    id: "shop",
    label: "SHOP",
    links: [
      // Small designs live in /shop#small-designs, large ones in /shop#large-designs.
      { label: "Sign Design", href: "/shop#small-designs", icon: Store },
      { label: "Bag Design", href: "/shop#small-designs", icon: ShoppingBag },
      { label: "Outdoor glass poster", href: "/shop#small-designs", icon: Image },
      { label: "Banner Design", href: "/shop#small-designs", icon: Flag },
      { label: "Large Billboard on a building", href: "/shop#large-designs", icon: Building2 },
      { label: "Rooftop advertising", href: "/shop#large-designs", icon: Home },
      { label: "Advertisement on the fence", href: "/shop#large-designs", icon: RectangleHorizontal },
      { label: "Billboard", href: "/shop#large-designs", icon: Megaphone },
    ],
  },
  {
    id: "about-pip",
    label: "ABOUT PIP",
    links: [
      { label: "How we work", href: "/#features", icon: Briefcase },
      { label: "Our partners", href: "/#partners", icon: Handshake },
      { label: "Studio news", href: "/#news", icon: Newspaper },
      { label: "Blog", href: "/blog", icon: BookOpen },
    ],
  },
  {
    id: "socnet",
    label: "SOCNET",
    links: SOCIAL_LINKS,
  },
];

function dropdownPanelClass(align: "start" | "center") {
  return cn(
    "absolute top-full z-20 -mt-1 min-w-[220px] animate-dropdown-in rounded-t-sm rounded-b-xl border border-t-0 border-navy/15 bg-white p-4 shadow-lg",
    align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
  );
}

function NavigationDropdown({
  item,
  activeDropdown,
  onActivate,
  onScheduleClose,
  align = "center",
}: {
  item: NavigationItem;
  activeDropdown: string | null;
  onActivate: (id: string) => void;
  onScheduleClose: () => void;
  align?: "start" | "center";
}) {
  const isActive = activeDropdown === item.id;
  const panelId = `navigation-dropdown-${item.id}`;
  const linkClassName = "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 font-body text-sm font-medium text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

  // Panels with more than 4 items grow horizontally: items fill vertical
  // columns of at most 4, then continue in the next column to the right.
  const isWide = item.links.length > 4;
  const columns = isWide ? Math.ceil(item.links.length / 4) : 1;
  const rows = isWide ? Math.ceil(item.links.length / columns) : item.links.length;

  const renderedLinks = item.links.map((link) => {
    const Icon = link.icon;
    const content = (
      <>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-navy/70" />
        <span>{link.label}</span>
      </>
    );

    return link.external ? (
      <a
        key={link.label}
        href={link.href}
        target="_blank"
        rel="noreferrer noopener"
        className={linkClassName}
      >
        {content}
      </a>
    ) : (
      <Link key={link.label} href={link.href} className={linkClassName}>
        {content}
      </Link>
    );
  });

  return (
    <div
      className="relative"
      onMouseEnter={() => onActivate(item.id)}
      onMouseLeave={onScheduleClose}
      onFocus={() => onActivate(item.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onScheduleClose();
        }
      }}
    >
      {/* `relative z-30` keeps the trigger above the open panel (z-20), so
          the button and the panel read as one continuous surface instead of
          the panel's shadow/edge painting over the button. Both share the
          same white background and the same hover tint. */}
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isActive}
        aria-controls={panelId}
        className={cn(
          "relative z-30 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-body text-[13px] font-medium uppercase tracking-wide text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy xl:px-3",
          isActive && "rounded-b-none bg-white hover:bg-white",
        )}
      >
        {item.label}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out",
            isActive && "rotate-180",
          )}
        />
      </button>
      {isActive ? (
        <div id={panelId} className={dropdownPanelClass(align)}>
          {isWide ? (
            <div
              className="grid grid-flow-col items-start gap-x-10 gap-y-1"
              style={{ gridTemplateRows: `repeat(${rows}, minmax(0, auto))` }}
            >
              {renderedLinks}
            </div>
          ) : (
            <div className="flex flex-col gap-1">{renderedLinks}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dropdownCloseTimeout.current !== null) {
        clearTimeout(dropdownCloseTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 50);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Open the auth modal when the admin guard redirects here with ?auth=login.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "login") {
      setAuthOpen(true);
      params.delete("auth");
      const query = params.toString();
      const cleaned = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
      window.history.replaceState(null, "", cleaned);
    }
  }, []);

  const clearDropdownCloseTimeout = () => {
    if (dropdownCloseTimeout.current !== null) {
      clearTimeout(dropdownCloseTimeout.current);
      dropdownCloseTimeout.current = null;
    }
  };

  const activateDropdown = (id: string) => {
    clearDropdownCloseTimeout();
    setActiveDropdown(id);
  };

  const scheduleDropdownClose = () => {
    clearDropdownCloseTimeout();
    dropdownCloseTimeout.current = setTimeout(() => {
      setActiveDropdown(null);
      dropdownCloseTimeout.current = null;
    }, 150);
  };

  const openLogin = () => {
    setMobileOpen(false);
    setAuthOpen(true);
  };

  return (
    <header
      className={cn(
        "site-header fixed inset-x-0 top-0 z-40 h-16 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-250 ease-out",
        scrolled
          ? "border-gray-100 bg-white/95 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 xl:px-12">
        {/* Left: brand logo (customer SVG lockup: green plus + wordmark) */}
        <Link
          href="/"
          aria-label="Plus In Plus home"
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          <Logo variant="header" className="h-9 w-auto sm:h-[42px]" />
        </Link>

        {/* Center: only the active dropdown is mounted at a time. */}
        <nav
          aria-label="Main navigation"
          className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex"
        >
          {navigation.map((item) => (
            <NavigationDropdown
              key={item.id}
              item={item}
              activeDropdown={activeDropdown}
              onActivate={activateDropdown}
              onScheduleClose={scheduleDropdownClose}
            />
          ))}
        </nav>

        {/* Right: language switch, Contact, Log in, burger */}
        <div className="relative z-30 flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Language: English"
            className="rounded-sm border-b border-navy px-1 pb-0.5 font-body text-sm font-medium leading-none text-[#052B42] transition-colors duration-200 ease-out hover:text-[#052B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            Aa
          </button>
          <HeaderButtonLink href="/contact" variant="outline" className="hidden lg:inline-flex">
            Contact
          </HeaderButtonLink>
          {session?.user ? (
            <button
              id="account-trigger"
              type="button"
              onClick={openLogin}
              aria-label="Open account"
              aria-haspopup="dialog"
              className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              <UserAvatar user={session.user} size={36} />
            </button>
          ) : (
            <HeaderButton
              id="account-trigger"
              variant="primary"
              type="button"
              onClick={openLogin}
              disabled={status === "loading"}
              aria-label="Log in"
              aria-haspopup="dialog"
              className="min-w-[6.25rem]"
            >
              {status === "loading" ? "Loading…" : "Log in"}
            </HeaderButton>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#052B42] transition-colors duration-200 ease-out hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy lg:hidden"
          >
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation (<1024px): sections are always expanded, no click menus. */}
      {mobileOpen ? (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-gray-100 bg-white px-5 pb-5 pt-2 font-body shadow-[0_16px_36px_rgba(10,37,64,0.12)] lg:hidden"
        >
          <nav aria-label="Mobile main navigation" className="space-y-4">
            {navigation.map((item) => (
              <div key={item.label}>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/60">
                  {item.label}
                </p>
                <div className="mt-1 flex flex-col">
                  {item.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-navy transition-colors duration-200 ease-out hover:bg-gray-50"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-navy transition-colors duration-200 ease-out hover:bg-gray-50"
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            <HeaderButtonLink
              href="/contact"
              variant="outline"
              onClick={() => setMobileOpen(false)}
              className="h-10 w-full px-4"
            >
              Contact
            </HeaderButtonLink>
            <HeaderButton
              type="button"
              variant="primary"
              onClick={openLogin}
              disabled={status === "loading"}
              aria-haspopup="dialog"
              className="h-10 w-full px-4"
            >
              {session?.user ? "Your account" : status === "loading" ? "Loading…" : "Log in"}
            </HeaderButton>
          </div>
        </div>
      ) : null}

      {authOpen ? <AccountModal open={authOpen} onOpenChange={setAuthOpen} /> : null}
    </header>
  );
}
