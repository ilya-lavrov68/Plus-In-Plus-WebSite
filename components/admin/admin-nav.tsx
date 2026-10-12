"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut, Palette, Settings, Users } from "lucide-react";
import { signOut } from "next-auth/react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Services", href: "/admin/services", icon: Palette },
  { label: "Blog", href: "/admin/blog", icon: BookOpen },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      const result = await logout();
      if (!result.ok) { setError(result.error ?? "Unable to log out."); return; }
      await signOut({ redirectTo: "/" });
    } catch {
      setError("Unable to log out. Please try again.");
    } finally {
      setPending(false);
    }
  }

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
        onClick={handleLogout}
        disabled={pending}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "justify-start gap-3 px-3 text-muted-foreground"
        )}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {pending ? "Logging out…" : "Log out"}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-800">{error}</p> : null}
    </nav>
  );
}
