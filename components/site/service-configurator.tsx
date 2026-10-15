"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import Link from "next/link";

import { notifyCartUpdated } from "@/components/site/cart-button";
import { Button } from "@/components/ui/button";
import type { ServicePricingView } from "@/lib/data";
import { calculateEstimate, formatKopecks, pricePrefix, showPublicPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface ServiceConfiguratorProps {
  pricing: ServicePricingView;
  /** Создаёт заявку на расчёт. Приходит с сервера — клиент не пишет в БД сам. */
  onSubmit: (selectedOptionIds: string[]) => Promise<{ ok: boolean; error?: string; orderNumber?: string }>;
  /** Кладёт услугу с выбранными опциями в корзину. Тоже server action. */
  onAddToCart?: (selectedOptionIds: string[]) => Promise<{ ok: boolean; error?: string; count?: number }>;
  className?: string;
}

/**
 * Конфигуратор услуги: выбор опций и расчётная цена.
 *
 * Показывает ОРИЕНТИР, а не цену к оплате. Финальную сумму согласует менеджер
 * — поэтому под ценой всегда есть сноска про это, а кнопка называется
 * «Запросить расчёт», а не «Купить». Формулировки важны: клиент не должен
 * думать, что увиденная цифра окончательная.
 *
 * Расчёт берётся из lib/pricing.ts — того же модуля, который использует
 * админка. Клиент и менеджер видят одни и те же числа.
 */
export function ServiceConfigurator({ pricing, onSubmit, onAddToCart, className }: ServiceConfiguratorProps) {
  const t = useTranslations("shop.configurator");
  const { status: authStatus } = useSession();

  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    // Стартовое состояние — опции по умолчанию для всех групп.
    //
    // И для необязательных тоже: иначе isDefault у них не имеет смысла, а
    // селект выглядит незаполненным. Выбранное всегда видно в разбивке цены,
    // поэтому «молча навязать» ничего нельзя — клиент видит каждую строчку.
    const initial: Record<string, string> = {};
    for (const group of pricing.groups) {
      const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
      if (fallback) initial[group.id] = fallback.id;
    }
    return initial;
  });

  const [pending, setPending] = React.useState(false);
  const [cartPending, setCartPending] = React.useState(false);
  const [addedToCart, setAddedToCart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedNumber, setSubmittedNumber] = React.useState<string | null>(null);

  const selectedIds = React.useMemo(
    () => Object.values(selected).filter(Boolean),
    [selected],
  );

  const estimate = React.useMemo(
    () => calculateEstimate(
      { basePrice: pricing.basePrice, priceType: pricing.priceType, groups: pricing.groups },
      selectedIds,
    ),
    [pricing, selectedIds],
  );

  const publicPrice = showPublicPrice(pricing.priceType);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!estimate.complete) {
      setError(t("selectAllRequired"));
      return;
    }

    setPending(true);
    try {
      const result = await onSubmit(selectedIds);
      if (result.ok) {
        setSubmittedNumber(result.orderNumber ?? null);
      } else {
        setError(result.error ?? null);
      }
    } catch {
      setError(t("priceOnRequest"));
    } finally {
      setPending(false);
    }
  }

  async function handleAddToCart() {
    if (!onAddToCart) return;
    setError(null);
    if (!estimate.complete) {
      setError(t("selectAllRequired"));
      return;
    }
    setCartPending(true);
    try {
      const result = await onAddToCart(selectedIds);
      if (result.ok) {
        setAddedToCart(true);
        // Бейдж в шапке слушает это событие и обновляет счётчик.
        notifyCartUpdated(result.count);
        window.setTimeout(() => setAddedToCart(false), 4000);
      } else {
        setError(result.error ?? null);
      }
    } catch {
      setError(t("addToCartFailed"));
    } finally {
      setCartPending(false);
    }
  }

  // Заявка отправлена — показываем подтверждение вместо формы.
  if (submittedNumber) {
    return (
      <section
        aria-live="polite"
        className={cn(
          "rounded-2xl border border-[#052B42]/15 bg-white p-6 shadow-sm sm:p-8",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00C56D] text-[#052B42]">
            <Check aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-geist text-xl font-semibold text-[#052B42]">
              {t("title")}
            </h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-[#052B42]/75">
              {t("submitted", { number: submittedNumber })} {t("managerNote")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-2xl border border-[#052B42]/15 bg-white p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      <h3 className="font-geist text-xl font-semibold text-[#052B42] sm:text-2xl">
        {t("title")}
      </h3>
      <p className="mt-1.5 font-body text-sm leading-relaxed text-[#052B42]/70">
        {t("subtitle")}
      </p>

      <div className="mt-6 space-y-6">
        {pricing.groups.map((group) => {
          const chosen = selected[group.id];
          return (
            <fieldset key={group.id}>
              <legend className="font-body text-sm font-semibold text-[#052B42]">
                {group.name}
                {!group.required && (
                  <span className="ml-2 font-normal text-[#052B42]/50">
                    {t("optional")}
                  </span>
                )}
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const active = chosen === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "cursor-pointer rounded-xl border px-4 py-2.5 font-body text-sm transition-colors duration-200 ease-out",
                        "focus-within:ring-2 focus-within:ring-[#052B42] focus-within:ring-offset-2",
                        active
                          ? "border-[#052B42] bg-[#052B42] text-white"
                          : "border-[#052B42]/20 bg-white text-[#052B42] hover:border-[#052B42]/45 hover:bg-[#052B42]/[0.04]",
                      )}
                    >
                      {/* Настоящий radio: даёт клавиатурную навигацию и работу
                          со скринридером бесплатно, без ручного ARIA. */}
                      <input
                        type="radio"
                        name={group.id}
                        value={option.id}
                        checked={active}
                        onChange={() =>
                          setSelected((previous) => ({ ...previous, [group.id]: option.id }))
                        }
                        className="sr-only"
                      />
                      <span>{option.label}</span>
                      {option.priceDelta !== 0 && (
                        <span className={cn("ml-1.5 text-xs", active ? "text-white/70" : "text-[#052B42]/55")}>
                          {option.priceDelta > 0 ? "+" : "−"}
                          {formatKopecks(Math.abs(option.priceDelta), pricing.currency)}
                        </span>
                      )}
                      {option.priceFactor !== 1 && (
                        <span className={cn("ml-1.5 text-xs", active ? "text-white/70" : "text-[#052B42]/55")}>
                          ×{option.priceFactor}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-7 border-t border-[#052B42]/10 pt-5">
        {publicPrice ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-body text-sm text-[#052B42]/70">
              {t("estimated")}:
            </span>
            <span className="font-geist text-3xl font-semibold tracking-tight text-[#052B42]">
              {pricePrefix(pricing.priceType)}
              {formatKopecks(estimate.estimatedAmount, pricing.currency)}
            </span>
          </div>
        ) : (
          <p className="font-body text-sm text-[#052B42]/70">{t("priceOnRequest")}</p>
        )}

        <p className="mt-2 font-body text-xs leading-relaxed text-[#052B42]/60">
          {t("managerNote")}
        </p>

        {/* Разбивка: чтобы клиент видел, из чего сложилась цифра, и не думал,
            что это число взято с потолка. */}
        {estimate.breakdown.length > 1 && (
          <ul className="mt-4 space-y-1 border-t border-[#052B42]/10 pt-3">
            {estimate.breakdown.map((line, index) => (
              <li
                key={`${line.label}-${index}`}
                className="flex justify-between gap-4 font-body text-xs text-[#052B42]/70"
              >
                <span>{line.kind === "base" ? t("base") : line.label}</span>
                <span className="shrink-0 tabular-nums">
                  {line.kind === "delta" && line.amount > 0 ? "+" : ""}
                  {formatKopecks(line.amount, pricing.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6">
        {authStatus === "authenticated" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={pending} disabled={!estimate.complete}>
              {t("requestQuote")}
            </Button>
            {onAddToCart ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                loading={cartPending}
                disabled={!estimate.complete || cartPending}
                onClick={() => void handleAddToCart()}
                className={cn(addedToCart && "border-[#00C56D] text-[#052B42]")}
              >
                {addedToCart ? (
                  <>
                    <Check aria-hidden="true" className="mr-2 h-4 w-4 text-[#00C56D]" />
                    {t("addedToCart")}
                  </>
                ) : (
                  t("addToCart")
                )}
              </Button>
            ) : null}
            {addedToCart ? (
              <Link
                href="/cart"
                className="font-body text-sm font-medium text-[#052B42] underline-offset-4 hover:underline"
              >
                {t("viewCart")}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Button type="button" size="lg" variant="outline" disabled>
              {t("signInToOrder")}
            </Button>
            <p className="font-body text-xs text-[#052B42]/60">{t("signInHint")}</p>
          </div>
        )}
      </div>
    </form>
  );
}
