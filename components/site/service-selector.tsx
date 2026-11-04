"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { PublicServiceItem } from "@/lib/data";
import { cn } from "@/lib/utils";

export interface ServiceSelectorProps {
  selectedServices: string[];
  onChange: (serviceIds: string[]) => void;
  initialServices?: PublicServiceItem[];
  onServicesLoaded?: (services: PublicServiceItem[]) => void;
}

export function ServiceSelector({
  selectedServices,
  onChange,
  initialServices,
  onServicesLoaded,
}: ServiceSelectorProps) {
  const t = useTranslations("services");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";
  const [services, setServices] = useState<PublicServiceItem[]>(
    initialServices ?? []
  );
  const [loading, setLoading] = useState<boolean>(!initialServices?.length);

  useEffect(() => {
    let active = true;
    fetch("/api/services")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!active || !Array.isArray(data)) return;
        const typed = data as PublicServiceItem[];
        setServices(typed);
        onServicesLoaded?.(typed);
      })
      .catch(() => {
        // Keep initial services if network request fails
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onServicesLoaded]);

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      onChange(selectedServices.filter((id) => id !== serviceId));
    } else {
      onChange([...selectedServices, serviceId]);
    }
  };

  const smallServices = services.filter((s) => s.category === "small");
  const largeServices = services.filter((s) => s.category === "large");

  const renderPrice = (service: PublicServiceItem) => {
    if (service.priceType === "quote" && service.basePrice <= 0) {
      return t("priceOnRequest");
    }
    const prefix = service.priceType === "from" ? `${t("from")} ` : "";
    return `${prefix}${service.basePrice.toLocaleString(numberLocale)} ₽`;
  };

  const renderSection = (title: string, items: PublicServiceItem[]) => (
    <div>
      <h3 className="mb-3 text-lg font-semibold tracking-tight">{title}</h3>
      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <Card
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={cn(
                  "cursor-pointer p-4 transition-colors duration-200",
                  isSelected
                    ? " bg-secondary/60"
                    : " bg-card/60 hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    aria-label={service.name}
                    className="mt-0.5"
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {service.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {renderPrice(service)}
                      </span>
                    </div>
                    {service.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {service.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("emptyCategory")}</p>
      )}
    </div>
  );

  if (loading && services.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {t("loadingServices")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection(t("smallDesigns"), smallServices)}
      {renderSection(t("largeDesigns"), largeServices)}
    </div>
  );
}
