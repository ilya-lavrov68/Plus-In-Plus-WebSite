"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Корзина в шапке — постоянная иконка рядом с аватаркой, в одном ряду и по
 * одной оси с ней (а не пункт внутри модального окна аккаунта). Ведёт на
 * страницу /cart; количество позиций показывает зелёный бейдж.
 *
 * Счётчик приходит из /api/cart/count и обновляется по событию
 * `pip:cart-updated`, которое рассылают все действия с корзиной.
 */

/** Одно имя события на всех: конфигуратор, страница корзины, шапка. */
export const CART_UPDATED_EVENT = "pip:cart-updated";

/** Сообщить шапке (и всем, кто слушает), что корзина изменилась. */
export function notifyCartUpdated(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { count } }));
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

  // Корзина требует входа: гостю иконка ничего не даст, поэтому не показываем.
  if (!session?.user) return null;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? t("openWithCount", { count }) : t("open")}
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
        className,
      )}
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00C56D] px-1 text-[10px] font-semibold leading-none text-[#052B42]"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
