"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

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
  const router = useRouter();

  const isSmall = service.category === "small";
  const priceLabel =
    service.priceType === "quote" && service.basePrice <= 0
      ? t("priceOnRequest")
      : `${service.priceType === "from" ? `${t("from")} ` : ""}${service.basePrice.toLocaleString("ru-RU")} ₽`;

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
        "flex h-full flex-col justify-between overflow-hidden transition-colors duration-200 hover:border-foreground/30",
        selected ? "border-primary bg-secondary/50" : "border-border bg-card"
      )}
    >
      <div>
        {service.coverImage ? (
          <Link
            href={`/shop/${encodeURIComponent(service.slug)}`}
            aria-label={service.name}
            className="block aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted/50"
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
                href={`/shop/${encodeURIComponent(service.slug)}`}
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
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            {service.description}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="text-lg font-bold tabular-nums">{priceLabel}</div>
          <Button
            type="button"
            variant={selected ? "secondary" : "default"}
            size="sm"
            onClick={handleSelect}
            className="gap-1.5"
          >
            {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {selected ? t("selected") : t("select")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
