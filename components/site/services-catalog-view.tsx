"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  ServiceCard,
  type ServiceCardData,
} from "@/components/site/service-card";

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
    <div style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)", paddingBottom: "var(--block-spacing)" }}>

      <section style={{ marginTop: "2rem" }}>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("smallDesigns")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smallDesignsDesc")}
          </p>
        </div>

        {smallServices.length > 0 ? (
          <div className="grid" style={{ rowGap: "1.5rem" }}>
            {smallServices.map((service) => (
              <div key={service.id} className="cols-4 cols-m-4">
                <ServiceCard service={service} selected={selectedIds.includes(service.id)} onSelect={toggleService} />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ border: "1px solid var(--theme-border-color)", padding: "1.5rem" }}>
            {t("emptyCategory")}
          </p>
        )}
      </section>

      <section style={{ marginTop: "4rem" }}>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("largeDesigns")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("largeDesignsDesc")}
          </p>
        </div>

        {largeServices.length > 0 ? (
          <div className="grid" style={{ rowGap: "1.5rem" }}>
            {largeServices.map((service) => (
              <div key={service.id} className="cols-4 cols-m-4">
                <ServiceCard service={service} selected={selectedIds.includes(service.id)} onSelect={toggleService} />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ border: "1px solid var(--theme-border-color)", padding: "1.5rem" }}>
            {t("emptyCategory")}
          </p>
        )}
      </section>

      {selectedIds.length > 0 ? (
        <div className="bottom-[var(--mobile-bottom-nav-clearance)] lg:bottom-[1.5rem]" style={{ position: "sticky", zIndex: 30, marginTop: "3rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", border: "1px solid var(--theme-border-color)", background: "var(--theme-bg)", padding: "1rem 1.5rem" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              style={{
                background: "none",
                border: 0,
                color: "var(--theme-elevation-650)",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {t("clearSelection")}
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="pl-btn"
              style={{ width: "auto", padding: "0.75rem 1.25rem" }}
            >
              {t("proceedToOrder")}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
