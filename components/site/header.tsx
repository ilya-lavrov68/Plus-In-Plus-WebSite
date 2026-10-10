"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { useSession } from "next-auth/react";

import { AccountModal } from "@/components/site/account-modal";
import { UserAvatar } from "@/components/site/user-avatar";
import { BrandMark } from "@/components/site/brand-mark";
import { cn } from "@/lib/utils";

type NavigationLink = { label: string; href: string };
type NavigationItem = { label: string; links: NavigationLink[] };

const navigation: NavigationItem[] = [
  {
    label: "FOR PLAY",
    links: [
      { label: "Order a design", href: "/shop" },
      { label: "Design categories", href: "/#categories" },
    ],
  },
  {
    label: "SHOP",
    links: [
      { label: "All designs", href: "/shop" },
      { label: "Small designs", href: "/shop#small-designs" },
      { label: "Large designs", href: "/shop#large-designs" },
    ],
  },
  {
    label: "ABOUT PIP",
    links: [
      { label: "How we work", href: "/#features" },
      { label: "Our partners", href: "/#partners" },
    ],
  },
  {
    label: "SOCNET",
    links: [
      { label: "News", href: "/#news" },
      { label: "Blog", href: "/blog" },
    ],
  },
];

function NavigationDropdown({
  item,
  compact = false,
  onNavigate,
}: {
  item: NavigationItem;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <details className={cn("group relative", compact && "border-b border-slate-200 last:border-b-0")}>
      <summary
        aria-haspopup="true"
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-[0.7rem] font-semibold tracking-[0.1em] text-[#0a2540] transition-colors duration-200 ease-out hover:text-[#397248] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] [&::-webkit-details-marker]:hidden",
          compact
            ? "justify-between py-3 text-sm"
            : "px-2 py-2 xl:px-3"
        )}
      >
        {item.label}
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <div
        className={cn(
          compact
            ? "pb-3 pl-3"
            : "absolute left-0 top-full z-50 min-w-52 pt-3"
        )}
      >
        <ul
          className={cn(
            "space-y-0.5",
            !compact && "rounded-xl border border-slate-200 bg-white p-2 shadow-[0_12px_32px_rgba(10,37,64,0.12)]"
          )}
        >
          {item.links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                onClick={onNavigate}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-200 ease-out hover:bg-slate-50 hover:text-[#0a2540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
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
        "fixed inset-x-0 top-0 z-40 h-16 border-b transition-[background-color,border-color,backdrop-filter] duration-250 ease-out",
        scrolled
          ? "border-slate-200 bg-white/95 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 xl:px-12">
        <Link
          href="/"
          aria-label="Plus In Plus home"
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
        >
          <BrandMark iconClassName="h-7 w-7" textClassName="text-base sm:text-lg" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => (
            <NavigationDropdown key={item.label} item={item} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Language: English"
            className="rounded-sm border-b border-[#0a2540] px-1 pb-0.5 text-sm font-medium leading-none text-[#0a2540] hover:text-[#397248] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
          >
            Aa
          </button>
          <Link
            href="/contact"
            className="hidden items-center justify-center rounded-full border border-[#0a2540]/45 px-5 py-2 text-sm font-medium text-[#0a2540] transition-colors duration-200 ease-out hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] lg:inline-flex"
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
              "inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] focus-visible:ring-offset-2 disabled:opacity-60",
              session?.user ? "p-0.5" : "bg-[#0a2540] px-4 py-2 text-white hover:bg-[#153c5c] sm:px-5",
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0a2540] transition-colors duration-200 ease-out hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] lg:hidden"
          >
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-5 pb-5 pt-2 shadow-[0_16px_36px_rgba(10,37,64,0.12)] lg:hidden"
        >
          <nav aria-label="Mobile main navigation">
            {navigation.map((item) => (
              <NavigationDropdown
                key={item.label}
                item={item}
                compact
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center rounded-full border border-[#0a2540]/45 px-4 py-2.5 text-sm font-medium text-[#0a2540] transition-colors duration-200 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
            >
              Contact
            </Link>
            <button
              type="button"
              onClick={openLogin}
              disabled={status === "loading"}
              aria-haspopup="dialog"
              className="inline-flex items-center justify-center rounded-full bg-[#0a2540] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#153c5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
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
