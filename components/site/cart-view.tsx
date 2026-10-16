"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  checkoutCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/app/actions/cart";
import { notifyCartUpdated } from "@/components/site/cart-button";
import { EmptyState } from "@/components/site/empty-state";
import { SafeImage } from "@/components/site/safe-image";
import { QuantityStepper } from "@/components/spectrumui/quantity-stepper";
import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/cart";
import { formatKopecks } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Страница корзины.
 *
 * Количество меняет Spectrum UI QuantityStepper; каждая правка уходит
 * server action-ом и подтверждается router.refresh() — суммы считает сервер,
 * клиент их только показывает. Кнопка внизу превращает корзину в одну
 * заявку на расчёт: цену согласует менеджер, поэтому итог подписан как
 * расчётный, а не как счёт к оплате.
 */

export interface CartViewProps {
  lines: CartLine[];
  totalEstimate: number;
  currency: string;
}

export function CartView({ lines, totalEstimate, currency }: CartViewProps) {
  const t = useTranslations("cart");
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [checkingOut, setCheckingOut] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [orderNumber, setOrderNumber] = React.useState<string | null>(null);

  async function changeQuantity(itemId: string, quantity: number) {
    setPendingId(itemId);
    setError(null);
    try {
      const result = await updateCartItemQuantity({ itemId, quantity });
      if (!result.ok) setError(result.error ?? null);
      else notifyCartUpdated(result.count);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(itemId: string) {
    setPendingId(itemId);
    setError(null);
    try {
      const result = await removeCartItem({ itemId });
      if (!result.ok) setError(result.error ?? null);
      else notifyCartUpdated(result.count);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    try {
      const result = await checkoutCart({ note });
      if (!result.ok) {
        setError(result.error ?? null);
        return;
      }
      setOrderNumber(result.orderNumber ?? null);
      notifyCartUpdated(0);
      router.refresh();
    } finally {
      setCheckingOut(false);
    }
  }

  // Заявка создана — подтверждение вместо списка.
  if (orderNumber) {
    return (
      <div className="rounded-2xl border border-[#052B42]/15 bg-white p-8 text-center shadow-sm">
        <p className="font-geist text-xl font-semibold text-[#052B42]">
          {t("submitted", { number: orderNumber })}
        </p>
        <p className="mt-2 text-sm text-[#052B42]/70">{t("submittedHint")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/orders">{t("toOrders")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">{t("continueShopping")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div>
        <EmptyState icon={ShoppingCart} title={t("emptyTitle")} description={t("emptyBody")} />
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/shop">{t("toShop")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hasUnavailable = lines.some((line) => line.unavailable);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:items-start">
      <ul className="space-y-4">
        {lines.map((line) => (
          <li
            key={line.id}
            className={cn(
              "flex gap-4 rounded-2xl border border-[#052B42]/12 bg-white p-4 shadow-sm sm:p-5",
              line.unavailable && "opacity-70",
            )}
          >
            <Link
              href={`/shop/${line.slug}`}
              className="relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#052B42]/[0.04] sm:block"
            >
              <SafeImage
                src={line.coverImage}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/shop/${line.slug}`}
                  className="font-geist text-base font-semibold text-[#052B42] underline-offset-4 hover:underline"
                >
                  {line.title}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  disabled={pendingId === line.id}
                  aria-label={t("remove")}
                  className="font-medium -mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#052B42]/50 transition-colors duration-200 ease-out hover:bg-[#B4232A]/[0.07] hover:text-[#B4232A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B4232A]"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              {line.options.length ? (
                <p className="mt-1 text-xs leading-relaxed text-[#052B42]/60">
                  {line.options.map((option) => `${option.group}: ${option.option}`).join(" · ")}
                </p>
              ) : null}

              {line.unavailable ? (
                <p className="mt-2 text-xs font-medium text-[#B4232A]">{t("itemUnavailable")}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <QuantityStepper
                  value={line.quantity}
                  min={1}
                  max={99}
                  size="sm"
                  disabled={pendingId === line.id || line.unavailable}
                  onValueChange={(quantity) => {
                    if (quantity !== line.quantity) void changeQuantity(line.id, quantity);
                  }}
                />
                <span className="font-geist text-base font-semibold tabular-nums text-[#052B42]">
                  {line.showPrice ? formatKopecks(line.lineEstimate, line.currency) : t("priceOnRequest")}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="rounded-2xl border border-[#052B42]/12 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
        <h2 className="font-geist text-lg font-semibold text-[#052B42]">{t("summary")}</h2>
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-[#052B42]/10 pt-4">
          <span className="text-sm text-[#052B42]/70">{t("estimatedTotal")}</span>
          <span className="font-geist text-2xl font-semibold tabular-nums text-[#052B42]">
            {formatKopecks(totalEstimate, currency)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#052B42]/60">{t("managerNote")}</p>

        <label htmlFor="cart-note" className="mt-4 block text-sm font-medium text-[#052B42]">
          {t("noteLabel")}
        </label>
        <textarea
          id="cart-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t("notePlaceholder")}
          className="mt-1.5 w-full rounded-xl border border-[#052B42]/15 bg-white px-3 py-2 text-sm text-[#052B42] placeholder:text-[#052B42]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[#B4232A]">
            {error}
          </p>
        ) : null}
        {hasUnavailable ? (
          <p className="mt-3 text-xs text-[#052B42]/60">{t("unavailableHint")}</p>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="mt-4 w-full"
          loading={checkingOut}
          disabled={checkingOut || !lines.length}
          onClick={() => void checkout()}
        >
          {t("checkout")}
        </Button>
        <Link
          href="/shop"
          className="mt-3 block text-center text-sm font-medium text-[#052B42] underline-offset-4 hover:underline"
        >
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
