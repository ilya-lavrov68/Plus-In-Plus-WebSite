"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updateServicePriceType } from "@/app/actions/services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Те же значения, что проверяет экшен. */
const PRICE_TYPES = ["fixed", "from", "quote"] as const;

export interface InlinePriceTypeProps {
  serviceId: string;
  priceType: string;
  isOrderable: boolean;
  disabled?: boolean;
}

/**
 * Тип цены: ровно / от / по запросу.
 *
 * Выбор сразу влияет на витрину: «от» добавляет приставку, «по запросу»
 * убирает кнопку заказа — такую услугу можно только обсудить с менеджером.
 */
export function InlinePriceType({ serviceId, priceType, isOrderable, disabled = false }: InlinePriceTypeProps) {
  const t = useTranslations("admin");
  const ta = useTranslations("actions");
  const [value, setValue] = React.useState<string>(
    (PRICE_TYPES as readonly string[]).includes(priceType) ? priceType : "quote",
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    setPending(true);
    try {
      const result = await updateServicePriceType({
        serviceId,
        priceType: next,
        // «По запросу» заказывать нельзя, для остальных оставляем как было.
        isOrderable: next === "quote" ? false : isOrderable,
      });
      if (!result.ok) {
        setValue(previous);
        setError(result.error ?? ta("updateServiceFailed"));
      }
    } catch {
      setValue(previous);
      setError(ta("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={change} disabled={pending || disabled}>
        <SelectTrigger className="h-8 w-[8.5rem]" aria-label={t("priceType")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRICE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {t(`priceType_${type}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
