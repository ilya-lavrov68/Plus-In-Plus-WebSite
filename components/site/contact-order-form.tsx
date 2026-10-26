"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Calendar, Layers, LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { createOrder } from "@/app/actions/orders";
import { ServiceSelector } from "@/components/site/service-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
      <div className="mb-10 flex flex-col justify-between gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("orderTitle")}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t("orderSubtitle")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
          <Link href="/services" className="gap-1.5">
            <Layers aria-hidden="true" className="h-4 w-4" />
            {t("browseCatalog")}
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {status === "unauthenticated" ? (
        <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 border-border bg-secondary/40 p-4 sm:px-6">
          <p className="text-sm text-muted-foreground">{t("signInNotice")}</p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/login" className="gap-2">
              <LogIn aria-hidden="true" className="h-4 w-4" />
              {t("signInButton")}
            </Link>
          </Button>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
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
            <p className="mt-2 text-sm text-destructive">
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
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={isLoading || selectedServices.length === 0}
            className="w-full"
          >
            {isLoading ? t("creatingOrder") : t("submitOrder")}
          </Button>
        </div>
      </form>
    </div>
  );
}
