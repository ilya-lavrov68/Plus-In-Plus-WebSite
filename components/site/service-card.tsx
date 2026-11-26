"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AddToCartButton } from "@/components/site/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
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
        "group flex h-full flex-col justify-between overflow-hidden transition-colors duration-200",
        // Наведение подсвечивает всю карточку: видно, что это один кликабельный блок,
        // а не набор отдельных подписей внутри.
        "hover:bg-white/[0.04]",
        selected ? " bg-secondary/50" : " bg-card"
      )}
    >
      <div>
        {service.coverImage ? (
          <Link
            href={`/services/${encodeURIComponent(service.slug)}`}
            aria-label={service.name}
            className="block aspect-[4/3] w-full overflow-hidden bg-muted/50"
          >
            <img
              src={service.coverImage}
              alt={service.name}
              className="size-full object-contain p-2"
            />
          </Link>
        ) : null}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-snug">
              <Link
                href={`/services/${encodeURIComponent(service.slug)}`}
                className="underline-offset-4 hover:underline"
              >
                {service.name}
              </Link>
            </CardTitle>
            <Badge
              variant={isSmall ? "default" : "secondary"}
              className="shrink-0"
            >
              {isSmall ? t("smallBadge") : t("largeBadge")}
            </Badge>
          </div>
        </CardHeader>
      </div>

      <CardContent className="flex flex-1 flex-col justify-between pt-0">
        {service.description ? (
          <p className="mb-6 text-sm leading-[1.65] text-muted-foreground">
            {service.description}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        <div className="space-y-3.5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-bold tabular-nums">{priceLabel}</div>
            <Button
              type="button"
              variant={selected ? "secondary" : "outline"}
              size="sm"
              onClick={handleSelect}
              className="gap-1.5"
            >
              {selected ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : null}
              {selected ? t("selected") : t("select")}
            </Button>
          </div>
          {service.isOrderable && service.priceType !== "quote" ? (
            <AddToCartButton
              itemType="service"
              itemId={service.id}
              itemName={service.name}
              size="sm"
              variant="neutral"
              className="w-full"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
