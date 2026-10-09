"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Search, ShoppingBag, User } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Order", href: "/shop", icon: ShoppingBag },
  { label: "Contact us", href: "/contact", icon: Mail },
  { label: "Log in", href: "/login", icon: User },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 50);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
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
        <Link href="/" className="shrink-0 rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl">
          Plus In Plus
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} aria-label={label} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2 sm:px-3")}>
              <Icon aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <Link href="/shop" aria-label="Search" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Search aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
