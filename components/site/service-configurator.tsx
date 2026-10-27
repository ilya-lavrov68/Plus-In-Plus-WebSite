"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import Link from "next/link";

import { notifyCartUpdated } from "@/components/site/cart-icon";
import { Button } from "@/components/ui/button";
import type { ServicePricingView } from "@/lib/data";
import {
  calculateEstimate,
  formatKopecks,
  showPublicPrice,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface ServiceConfiguratorProps {
  pricing: ServicePricingView;
  onSubmit: (selectedOptionIds: string[]) => Promise<{
    ok: boolean;
    error?: string;
    orderNumber?: string;
  }>;
  onAddToCart?: (selectedOptionIds: string[]) => Promise<{
    ok: boolean;
    error?: string;
    count?: number;
  }>;
  className?: string;
}

export function ServiceConfigurator({
  pricing,
  onSubmit,
  onAddToCart,
  className,
}: ServiceConfiguratorProps) {
  const t = useTranslations("shop.configurator");
  const locale = useLocale();
  const { status: authStatus } = useSession();

  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of pricing.groups) {
      const fallback =
        group.options.find((option) => option.isDefault) ?? group.options[0];
      if (fallback) initial[group.id] = fallback.id;
    }
    return initial;
  });

  const [pending, setPending] = React.useState(false);
  const [cartPending, setCartPending] = React.useState(false);
  const [addedToCart, setAddedToCart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedNumber, setSubmittedNumber] = React.useState<string | null>(
    null
  );

  const selectedIds = React.useMemo(
    () => Object.values(selected).filter(Boolean),
    [selected]
  );

  const estimate = React.useMemo(
    () =>
      calculateEstimate(
        {
          basePrice: pricing.basePrice,
          priceType: pricing.priceType,
          groups: pricing.groups,
        },
        selectedIds
      ),
    [pricing, selectedIds]
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

  if (submittedNumber) {
    return (
      <section
        aria-live="polite"
        className={cn(
          "rounded-2xl border border-border bg-card p-6 sm:p-8",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {t("title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
        "rounded-2xl border border-border bg-card p-6 sm:p-8",
        className
      )}
    >
      <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
        {t("title")}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("subtitle")}
      </p>

      <div className="mt-6 space-y-6">
        {pricing.groups.map((group) => {
          const chosen = selected[group.id];
          return (
            <fieldset key={group.id}>
              <legend className="text-sm font-semibold text-foreground">
                {group.name}
                {!group.required && (
                  <span className="ml-2 font-normal text-muted-foreground">
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
                        "cursor-pointer rounded-xl border px-4 py-2.5 text-sm transition-colors",
                        "focus-within:ring-2 focus-within:ring-ring",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary/40 text-foreground hover:border-foreground/40 hover:bg-secondary"
                      )}
                    >
                      <input
                        type="radio"
                        name={group.id}
                        value={option.id}
                        checked={active}
                        onChange={() =>
                          setSelected((previous) => ({
                            ...previous,
                            [group.id]: option.id,
                          }))
                        }
                        className="sr-only"
                      />
                      <span>{option.label}</span>
                      {option.priceDelta !== 0 && (
                        <span
                          className={cn(
                            "ml-1.5 text-xs",
                            active
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          )}
                        >
                          {option.priceDelta > 0 ? "+" : "−"}
                          {formatKopecks(
                            Math.abs(option.priceDelta),
                            pricing.currency,
                            locale
                          )}
                        </span>
                      )}
                      {option.priceFactor !== 1 && (
                        <span
                          className={cn(
                            "ml-1.5 text-xs",
                            active
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          )}
                        >
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

      <div className="mt-7 border-t border-border pt-5">
        {publicPrice ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm text-muted-foreground">
              {t("estimated")}:
            </span>
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {pricing.priceType === "from" ? `${t("from")} ` : ""}
              {formatKopecks(estimate.estimatedAmount, pricing.currency, locale)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("priceOnRequest")}
          </p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t("managerNote")}
        </p>

        {estimate.breakdown.length > 1 && (
          <ul className="mt-4 space-y-1 border-t border-border pt-3">
            {estimate.breakdown.map((line, index) => (
              <li
                key={`${line.label}-${index}`}
                className="flex justify-between gap-4 text-xs text-muted-foreground"
              >
                <span>{line.kind === "base" ? t("base") : line.label}</span>
                <span className="shrink-0 tabular-nums">
                  {line.kind === "delta" && line.amount > 0 ? "+" : ""}
                  {formatKopecks(line.amount, pricing.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6">
        {authStatus === "authenticated" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={!estimate.complete}
            >
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
                className={cn(addedToCart && "border-primary text-foreground")}
              >
                {addedToCart ? (
                  <>
                    <Check
                      aria-hidden="true"
                      className="mr-2 h-4 w-4 text-foreground"
                    />
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
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
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
            <p className="text-xs text-muted-foreground">{t("signInHint")}</p>
          </div>
        )}
      </div>
    </form>
  );
}
