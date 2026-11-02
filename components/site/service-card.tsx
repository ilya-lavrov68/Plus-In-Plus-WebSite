"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AddToCartButton } from "@/components/site/add-to-cart-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ServiceCardData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Base price in rubles. */
  basePrice: number;
  priceType?: string;
  isOrderable?: boolean;
  coverImage?: string;
  category: string;
}

export interface ServiceCardProps {
  service: ServiceCardData;
  selected?: boolean;
  onSelect?: (service: ServiceCardData) => void;
}

/**
 * Карточка услуги: одна видимая кнопка действия и тихая ссылка в корзину.
 * Категория здесь — микроподпись, а не дублирующий бейдж: разделы каталога
 * уже задают группу, поэтому второй ярлык только шумит.
 */
export function ServiceCard({
  service,
  selected = false,
  onSelect,
}: ServiceCardProps) {
  const t = useTranslations("services");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";
  const router = useRouter();

  const isSmall = service.category === "small";
  const priceLabel =
    service.priceType === "quote" && service.basePrice <= 0
      ? t("priceOnRequest")
      : `${service.priceType === "from" ? `${t("from")} ` : ""}${service.basePrice.toLocaleString(numberLocale)} ₽`;
  const canOrder = Boolean(service.isOrderable && service.priceType !== "quote");

  const handleSelect = () => {
    if (onSelect) {
      onSelect(service);
      return;
    }
    router.push(`/contact?services=${encodeURIComponent(service.id)}`);
  };

  return (
    <Card
      className={cn(
        "flex h-full flex-col justify-between rounded-none border transition-colors duration-200",
        selected
          ? "border-primary/70 bg-primary/[0.05]"
          : "border-border bg-card/60 hover:border-foreground/25"
      )}
    >
      <div>
        {service.coverImage ? (
          <Link
            href={`/shop/${encodeURIComponent(service.slug)}`}
            aria-label={service.name}
            className="block aspect-[16/9] w-full overflow-hidden border-b border-border bg-muted/40"
          >
            <img
              src={service.coverImage}
              alt={service.name}
              className="size-full object-contain p-3"
            />
          </Link>
        ) : null}

        <CardHeader className="gap-0 p-6 pb-4">
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
            {isSmall ? t("smallBadge") : t("largeBadge")}
          </p>
          <CardTitle className="mt-2 text-base leading-snug font-semibold sm:text-lg">
            <Link
              href={`/shop/${encodeURIComponent(service.slug)}`}
              className="underline-offset-4 hover:underline"
            >
              {service.name}
            </Link>
          </CardTitle>
        </CardHeader>
      </div>

      <CardContent className="flex flex-1 flex-col justify-between p-6 pt-0">
        {service.description ? (
          <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
            {service.description}
          </p>
        ) : (
          <div />
        )}

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-border/60 pt-4">
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
              {t("priceLabel")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{priceLabel}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              variant={selected ? "secondary" : "outline"}
              size="sm"
              onClick={handleSelect}
              className={cn("gap-1.5", selected && "text-primary")}
            >
              {selected ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : null}
              {selected ? t("selected") : t("select")}
            </Button>
            {canOrder ? (
              <AddToCartButton
                itemType="service"
                itemId={service.id}
                itemName={service.name}
                size="sm"
                variant="ghost"
                className="h-auto px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
