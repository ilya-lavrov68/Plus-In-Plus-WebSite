"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, Search, ShoppingBag, User } from "lucide-react";

import { AuthModal } from "@/components/site/auth-modal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Order", href: "/shop", icon: ShoppingBag },
  { label: "Contact us", href: "/contact", icon: Mail },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

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

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-16 border-b transition-[background-color,border-color,backdrop-filter] duration-250 ease-out",
        scrolled
          ? "border-border bg-white/95 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-8">
        <Link href="/" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Plus In Plus">
          {logoFailed ? (
            <span className="text-lg font-semibold tracking-tight sm:text-xl">Plus In Plus</span>
          ) : (
            <Image
              src="/assets/logos/plus-in-plus.svg"
              alt="Plus In Plus"
              width={160}
              height={40}
              className="h-9 w-auto"
              onError={() => setLogoFailed(true)}
            />
          )}
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} aria-label={label} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2 sm:px-3")}>
              <Icon aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            aria-label="Log in"
            onClick={() => setAuthOpen(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2 sm:px-3")}
          >
            <User aria-hidden="true" />
            <span className="hidden sm:inline">Log in</span>
          </button>
          <Link href="/shop" aria-label="Search" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Search aria-hidden="true" />
          </Link>
        </nav>
      </div>
      {authOpen ? <AuthModal open={authOpen} onOpenChange={setAuthOpen} /> : null}
    </header>
  );
}
