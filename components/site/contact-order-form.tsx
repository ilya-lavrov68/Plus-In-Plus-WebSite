"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Calendar } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { createOrder } from "@/app/actions/orders";
import { ServiceSelector } from "@/components/site/service-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { PublicServiceItem } from "@/lib/data";

export interface ContactOrderFormProps {
  initialServices?: PublicServiceItem[];
  initialSelectedIds?: string[];
}

export function ContactOrderForm({
  initialServices = [],
  initialSelectedIds = [],
}: ContactOrderFormProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useTranslations("contact");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";

  const [selectedServices, setSelectedServices] =
    useState<string[]>(initialSelectedIds);
  const [loadedServices, setLoadedServices] =
    useState<PublicServiceItem[]>(initialServices);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleServicesLoaded = useCallback((items: PublicServiceItem[]) => {
    setLoadedServices(items);
  }, []);

  const estimatedRub = useMemo(() => {
    return loadedServices
      .filter((svc) => selectedServices.includes(svc.id))
      .reduce((sum, svc) => sum + (svc.basePrice || 0), 0);
  }, [loadedServices, selectedServices]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (selectedServices.length === 0) {
      setError(t("selectServicesError"));
      return;
    }

    if (!session?.user) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const created = await createOrder({
        serviceIds: selectedServices,
        deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`) : null,
        description,
      });
      toast({
        title: created.orderNumber,
        description: t("thankYou"),
      });
      router.push("/cart");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("orderCreateError");
      setError(message);
      toast({
        title: t("orderCreateError"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)", paddingBottom: "var(--block-spacing)" }}>
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div style={{ maxWidth: "48rem" }}>
          <p className="pl-h6">Plus In Plus</p>
          <h1 className="pl-h1">{t("orderTitle")}</h1>
          <p className="pl-body">{t("orderSubtitle")}</p>
        </div>
        <Link className="pl-btn" href="/services" style={{ width: "auto", whiteSpace: "nowrap" }}>
          {t("browseCatalog")}
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {status === "unauthenticated" ? (
        <div
          className="mb-8 flex flex-wrap items-center justify-between gap-4"
          style={{ border: "1px solid var(--theme-border-color)", padding: "1rem 1.5rem" }}
        >
          <p className="pl-small">{t("signInNotice")}</p>
          <Link className="pl-btn" href="/login" style={{ width: "auto" }}>
            {t("signInButton")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="pw-form" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Label className="text-lg font-semibold">
              {t("selectServicesLabel")}
            </Label>
            <span className="text-sm text-muted-foreground">
              {t("selectedCount", { count: selectedServices.length })}
            </span>
          </div>

          <ServiceSelector
            selectedServices={selectedServices}
            onChange={(ids) => {
              setSelectedServices(ids);
              if (ids.length > 0) setError(null);
            }}
            initialServices={initialServices}
            onServicesLoaded={handleServicesLoaded}
          />

          {selectedServices.length === 0 ? (
            <p className="mt-2 text-sm text-destructive-text">
              {t("selectServicesError")}
            </p>
          ) : null}
        </div>

        <div className="glass-panel grid gap-6 rounded-2xl border border-border bg-background/65 p-6 sm:p-8">
          <div className="space-y-2">
            <Label htmlFor="deadline" className="inline-flex items-center gap-2">
              <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              {t("deadlineLabel")}
            </Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={minDate}
              className="sm:max-w-xs"
            />
            <p className="text-sm text-muted-foreground">{t("deadlineHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={5}
              maxLength={4000}
            />
          </div>

          {selectedServices.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("estimatedTotal")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("finalPriceByManager")}
                </p>
              </div>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {estimatedRub.toLocaleString(numberLocale)} ₽
              </div>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-text"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="pl-btn"
            disabled={isLoading || selectedServices.length === 0}
          >
            {isLoading ? t("creatingOrder") : t("submitOrder")}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
