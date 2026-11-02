"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRightIcon } from "lucide-animated";
import { useLocale, useTranslations } from "next-intl";

import { ServicesGridBand } from "@/components/site/page-geometry";
import {
  ServiceCard,
  type ServiceCardData,
} from "@/components/site/service-card";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ServicesCatalogViewProps {
  smallServices: ServiceCardData[];
  largeServices: ServiceCardData[];
}

interface CatalogSectionProps {
  index: string;
  title: string;
  description: string;
  count: number;
  emptyLabel: string;
  services: ServiceCardData[];
  selectedIds: string[];
  onToggle: (service: ServiceCardData) => void;
  className?: string;
}

/**
 * Реестр услуг: номер, заголовок и счётчик в одной строке, затем сетка.
 * Секции отличаются номером и содержанием, а не цветом и не иконками.
 */
function CatalogSection({
  index,
  title,
  description,
  count,
  emptyLabel,
  services,
  selectedIds,
  onToggle,
  className,
}: CatalogSectionProps) {
  return (
    <section className={cn("border-t border-border pt-8", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-5 sm:gap-7">
          <span className="text-xs font-medium tracking-[0.22em] text-muted-foreground/60 tabular-nums">
            {index}
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <span className="text-xs tracking-[0.14em] text-muted-foreground/70 tabular-nums uppercase">
          {count}
        </span>
      </div>

      {services.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={selectedIds.includes(service.id)}
              onSelect={onToggle}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 border-t border-dashed border-border pt-6 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </section>
  );
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

  const minBasePrice = useMemo(() => {
    const prices = allServices
      .map((service) => service.basePrice)
      .filter((price) => price > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [allServices]);

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
    <div className="container relative isolate py-16 md:py-24">
      <ServicesGridBand />

      <header className="border-b border-border/60 pb-12 md:pb-16">
        <p className="pip-eyebrow">{t("eyebrow")}</p>

        <div className="mt-6 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.05]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          <dl className="flex shrink-0 gap-10 sm:gap-14">
            <div>
              <dt className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                {t("catalogCountLabel")}
              </dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {allServices.length}
              </dd>
            </div>
            {minBasePrice !== null ? (
              <div>
                <dt className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                  {t("catalogFromLabel")}
                </dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {minBasePrice.toLocaleString(numberLocale)} ₽
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <Link
          href="/contact"
          className="group mt-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-8 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          data-pip-icon-trigger
        >
          {t("proceedToOrder")}
          <AnimatedIcon icon={ArrowRightIcon} size={16} />
        </Link>
      </header>

      <CatalogSection
        className="mt-14 md:mt-20"
        index="01"
        title={t("smallDesigns")}
        description={t("smallDesignsDesc")}
        count={smallServices.length}
        emptyLabel={t("emptyCategory")}
        services={smallServices}
        selectedIds={selectedIds}
        onToggle={toggleService}
      />

      <CatalogSection
        className="mt-20 md:mt-24"
        index="02"
        title={t("largeDesigns")}
        description={t("largeDesignsDesc")}
        count={largeServices.length}
        emptyLabel={t("emptyCategory")}
        services={largeServices}
        selectedIds={selectedIds}
        onToggle={toggleService}
      />

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-[var(--mobile-bottom-nav-clearance)] z-30 mt-16 flex flex-wrap items-center justify-between gap-4 rounded-none border border-border bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:bottom-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-sm font-semibold text-foreground">
              {t("selectedSummary", { count: selectedIds.length })}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
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
            <Button
              type="button"
              onClick={handleProceed}
              className="gap-2"
              data-pip-icon-trigger
            >
              {t("proceedToOrder")}
              <AnimatedIcon icon={ArrowRightIcon} size={16} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
