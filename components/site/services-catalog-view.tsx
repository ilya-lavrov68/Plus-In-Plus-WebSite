"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRightIcon } from "lucide-animated";
import { useLocale, useTranslations } from "next-intl";

import {
  ServiceCard,
  type ServiceCardData,
} from "@/components/site/service-card";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { ServicesGridBand } from "@/components/site/page-geometry";
import { Button } from "@/components/ui/button";

export interface ServicesCatalogViewProps {
  smallServices: ServiceCardData[];
  largeServices: ServiceCardData[];
}

export function ServicesCatalogView({
  smallServices,
  largeServices,
}: ServicesCatalogViewProps) {
  const t = useTranslations("services");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allServices = useMemo(
    () => [...smallServices, ...largeServices],
    [smallServices, largeServices]
  );

  const toggleService = (service: ServiceCardData) => {
    setSelectedIds((prev) =>
      prev.includes(service.id)
        ? prev.filter((id) => id !== service.id)
        : [...prev, service.id]
    );
  };

  const estimatedBaseRub = useMemo(() => {
    return allServices
      .filter((svc) => selectedIds.includes(svc.id))
      .reduce((sum, svc) => sum + (svc.basePrice || 0), 0);
  }, [allServices, selectedIds]);

  const handleProceed = () => {
    if (selectedIds.length === 0) {
      router.push("/contact");
      return;
    }
    const query = selectedIds.map(encodeURIComponent).join(",");
    router.push(`/contact?services=${query}`);
  };

  return (
    <div className="container relative isolate overflow-hidden py-24 md:py-32">
      <ServicesGridBand />
      <div className="flex flex-col justify-between gap-6 border-b border-border/60 pb-10 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/contact"
          className="group inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-8 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          data-pip-icon-trigger
        >
          {t("proceedToOrder")}
          <AnimatedIcon icon={ArrowRightIcon} size={16} />
        </Link>
      </div>

      <section className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("smallDesigns")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smallDesignsDesc")}
          </p>
        </div>

        {smallServices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {smallServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={selectedIds.includes(service.id)}
                onSelect={toggleService}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            {t("emptyCategory")}
          </p>
        )}
      </section>

      <section className="mt-16">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("largeDesigns")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("largeDesignsDesc")}
          </p>
        </div>

        {largeServices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {largeServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={selectedIds.includes(service.id)}
                onSelect={toggleService}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            {t("emptyCategory")}
          </p>
        )}
      </section>

      {selectedIds.length > 0 ? (
        <div className="glass-panel sticky bottom-[var(--mobile-bottom-nav-clearance)] z-30 mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/65 p-4 sm:px-6 lg:bottom-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-semibold text-foreground">
              {t("selectedSummary", { count: selectedIds.length })}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {t("estimatedBase", {
                amount: `${estimatedBaseRub.toLocaleString(numberLocale)} ₽`,
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              {t("clearSelection")}
            </Button>
            <Button type="button" onClick={handleProceed} className="gap-2" data-pip-icon-trigger>
              {t("proceedToOrder")}
              <AnimatedIcon icon={ArrowRightIcon} size={16} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
