"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { usePathname } from "next/navigation";
import { LogOut, ShoppingCart } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Навигация менеджера: только заявки.
 *
 * Здесь намеренно нет услуг, блога, пользователей и настроек — управление
 * сайтом остаётся у администратора. Даже если менеджер узнает адрес
 * /admin/services, middleware и requireAdmin его не пустят.
 */
const links = [{ key: "orders", href: "/manager/orders", icon: ShoppingCart }];

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
              "justify-start gap-3 px-3",
              active ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t(key)}
          </Link>
        );
      })}

      {/* Администратор тоже может работать здесь как менеджер, поэтому ему
          показываем дорогу обратно в управление сайтом. */}
      {canEditSite ? (
        <Link
          href="/admin/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "justify-start gap-3 px-3 text-muted-foreground",
          )}
        >
          {t("dashboard")}
        </Link>
      ) : null}

      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "justify-start gap-3 px-3 text-muted-foreground",
        )}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {pending ? ta("loggingOut") : ta("logout")}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </nav>
  );
}
