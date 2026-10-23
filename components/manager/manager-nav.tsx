"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, LogOut, ShoppingCart, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Навигация менеджера: только заявки.
 */
const links = [
  { key: "orders", href: "/manager/orders", icon: ShoppingCart },
  { key: "users", href: "/manager/users", icon: Users },
];

export function ManagerNav({ canEditSite }: { canEditSite: boolean }) {
  const t = useTranslations("admin");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      const result = await logout();
      if (!result.ok) {
        setError(result.error ?? ta("logoutFailed"));
        return;
      }
      await signOut({ redirectTo: "/" });
    } catch {
      setError(ta("logoutRetry"));
    } finally {
      setPending(false);
    }
  }

  return (
    <nav aria-label={t("navigation")} className="flex flex-col gap-1">
      {links.map(({ key, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-9 justify-start gap-3 rounded-lg px-3",
              active
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(key)}</span>
          </Link>
        );
      })}

      {canEditSite ? (
        <Link
          href="/admin/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-9 justify-start gap-3 rounded-lg px-3 text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("dashboard")}</span>
        </Link>
      ) : null}

      <Separator className="my-2" />

      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-9 justify-start gap-3 rounded-lg px-3 text-muted-foreground hover:text-foreground"
        )}
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{t("viewSite")}</span>
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-9 justify-start gap-3 rounded-lg px-3 text-muted-foreground hover:text-foreground"
        )}
      >
        <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {pending ? ta("loggingOut") : ta("logout")}
        </span>
      </button>

      {error ? (
        <p role="alert" className="mt-2 px-3 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </nav>
  );
}
