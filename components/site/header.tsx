"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { useSession } from "next-auth/react";

import { AccountModal } from "@/components/site/account-modal";
import { UserAvatar } from "@/components/site/user-avatar";
import { Logo } from "@/components/site/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationLink = { label: string; href: string; external?: boolean };
type NavigationItem = { label: string; links: NavigationLink[] };

// Social profiles are placeholders until the studio confirms its handles.
const SOCIAL_LINKS: NavigationLink[] = [
  { label: "VK", href: "https://vk.com/plusinplus", external: true },
  { label: "Telegram", href: "https://t.me/plusinplus", external: true },
  { label: "YouTube", href: "https://www.youtube.com/@plusinplus", external: true },
];

const navigation: NavigationItem[] = [
  {
    label: "FOR PLAY",
    links: [
      { label: "Order a design", href: "/shop" },
      { label: "Design categories", href: "/#categories" },
      { label: "Small designs", href: "/shop#small-designs" },
      { label: "Large designs", href: "/shop#large-designs" },
    ],
  },
  {
    label: "SHOP",
    links: [
      // Small designs live in /shop#small-designs, large ones in /shop#large-designs.
      { label: "Sign Design", href: "/shop#small-designs" },
      { label: "Bag Design", href: "/shop#small-designs" },
      { label: "Outdoor glass poster", href: "/shop#small-designs" },
      { label: "Banner Design", href: "/shop#small-designs" },
      { label: "Large Billboard on a building", href: "/shop#large-designs" },
      { label: "Rooftop advertising", href: "/shop#large-designs" },
      { label: "Advertisement on the fence", href: "/shop#large-designs" },
      { label: "Billboard", href: "/shop#large-designs" },
    ],
  },
  {
    label: "ABOUT PIP",
    links: [
      { label: "How we work", href: "/#features" },
      { label: "Our partners", href: "/#partners" },
      { label: "Studio news", href: "/#news" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    label: "SOCNET",
    links: SOCIAL_LINKS,
  },
];

/**
 * Navigation dropdowns open on hover (and on keyboard focus), never on click.
 *
 * The panel is a plain CSS child of a `group`, so Radix/JS click handling is not
 * involved. `delay-200` on the closed state holds the panel visible for ~200ms
 * after the pointer leaves, which is what lets the cursor travel across the
 * 8px gap into the menu; hovering the panel keeps `group-hover` active.
 */
function dropdownPanelClass(align: "start" | "center") {
  return cn(
    "invisible absolute top-full z-50 mt-2 min-w-[200px] rounded-xl border border-gray-200 bg-white p-4 opacity-0 shadow-lg",
    "transition-all duration-200 ease-out delay-200",
    "group-hover:visible group-hover:opacity-100 group-hover:delay-0",
    "group-focus-within:visible group-focus-within:opacity-100 group-focus-within:delay-0",
    align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
  );
}

function NavigationDropdown({
  item,
  align = "center",
}: {
  item: NavigationItem;
  align?: "start" | "center";
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-body text-[13px] font-medium uppercase tracking-wide text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy xl:px-3"
      >
        {item.label}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out group-hover:rotate-180 group-focus-within:rotate-180"
        />
      </button>
      <div className={dropdownPanelClass(align)}>
        <div className="flex flex-col gap-1">
          {item.links.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="whitespace-nowrap rounded-lg px-3 py-2 font-body text-sm font-medium text-navy transition-colors duration-200 ease-out hover:bg-gray-50"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="whitespace-nowrap rounded-lg px-3 py-2 font-body text-sm font-medium text-navy transition-colors duration-200 ease-out hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <Logo variant="header" className="h-12 w-auto sm:h-14" />
        </Link>

        {/* Center: main navigation, dropdowns open on hover (CSS group-hover) */}
        <nav
          aria-label="Main navigation"
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex"
        >
          {navigation.map((item) => (
            <NavigationDropdown key={item.label} item={item} />
          ))}
        </nav>

        {/* Right: language switch, Contact, Log in, burger */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Language: English"
            className="rounded-sm border-b border-navy px-1 pb-0.5 font-body text-sm font-medium leading-none text-[#052B42] transition-colors duration-200 ease-out hover:text-[#052B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            Aa
          </button>
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden lg:inline-flex")}
          >
            Contact
          </Link>
          <button
            id="account-trigger"
            type="button"
            onClick={openLogin}
            disabled={status === "loading"}
            aria-label={session?.user ? "Open account" : "Log in"}
            aria-haspopup="dialog"
            className={cn(
              "disabled:opacity-60",
              session?.user
                ? "rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
                : buttonVariants({ variant: "default", size: "sm", className: "min-w-[6.25rem]" })
            )}
          >
            {session?.user ? <UserAvatar user={session.user} size={36} /> : status === "loading" ? "Loading…" : "Log in"}
          </button>
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
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "default" }), "h-10")}
            >
              Contact
            </Link>
            <button
              type="button"
              onClick={openLogin}
              disabled={status === "loading"}
              aria-haspopup="dialog"
              className={cn(buttonVariants({ variant: "default", size: "default" }), "h-10")}
            >
              {session?.user ? "Your account" : "Log in"}
            </button>
          </div>
        </div>
      ) : null}

      {authOpen ? <AccountModal open={authOpen} onOpenChange={setAuthOpen} /> : null}
    </header>
  );
}
