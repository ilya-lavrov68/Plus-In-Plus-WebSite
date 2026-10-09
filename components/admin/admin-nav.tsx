"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut, Palette, Users } from "lucide-react";
import { signOut } from "next-auth/react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Services", href: "/admin/services", icon: Palette },
  { label: "Blog", href: "/admin/blog", icon: BookOpen },
  { label: "Users", href: "/admin/users", icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {links.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "justify-start gap-3 px-3",
              active ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "justify-start gap-3 px-3 text-muted-foreground"
        )}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Log out
      </button>
    </nav>
  );
}
