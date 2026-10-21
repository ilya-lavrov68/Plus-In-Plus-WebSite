"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export const CART_UPDATED_EVENT = "pip:cart-updated";

export function notifyCartUpdated(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT, { detail: { count } })
  );
}

export function CartButton({ className }: { className?: string }) {
  const { data: session } = useSession();
  const t = useTranslations("cart");
  const [count, setCount] = React.useState(0);

  const refresh = React.useCallback(() => {
    fetch("/api/cart/count")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.count === "number") setCount(data.count);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!session?.user) return;
    refresh();

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") setCount(detail.count);
      else refresh();
    };
    window.addEventListener(CART_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdated);
  }, [session?.user, refresh]);

  if (!session?.user) return null;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? t("openWithCount", { count }) : t("open")}
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
