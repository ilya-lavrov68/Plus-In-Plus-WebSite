"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export const CART_UPDATED_EVENT = "pip:cart-updated";

export function notifyCartUpdated(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT, { detail: { count } })
  );
}

export function CartIcon({ className }: { className?: string }) {
  const { data: session } = useSession();
  const t = useTranslations("cart");
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/cart", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (typeof data.count === "number") {
          setCount(data.count);
        } else if (Array.isArray(data.items)) {
          setCount(
            data.items.reduce(
              (sum: number, item: { quantity?: number }) =>
                sum + (item.quantity || 1),
              0
            )
          );
        }
      })
      .catch(() => setCount(0));
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setCount(0);
      return;
    }

    refresh();

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setCount(detail.count);
      } else {
        refresh();
      }
    };

    window.addEventListener(CART_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdated);
  }, [session?.user, refresh]);

  if (!session?.user) return null;

  return (
    <Link
      href="/cart"
      data-testid="cart-icon"
      aria-label={count > 0 ? t("openWithCount", { count }) : t("open")}
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors duration-200 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
