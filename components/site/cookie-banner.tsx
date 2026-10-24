"use client";

import { useEffect, useState } from "react";
import { Check, Cookie, Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  readConsent,
  writeConsent,
  type ConsentPreferences,
} from "@/lib/analytics-consent";

const DEFAULT_PREFERENCES: ConsentPreferences = {
  // Необходимые cookie всегда включены: без них сайт не работает.
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
};

/**
 * Всплывающее уведомление о cookie-файлах.
 *
 * Показывается один раз, пока посетитель не сделал выбор; выбор сохраняется
 * в localStorage и больше не беспокоит. Баннер легко закрыть крестиком и он
 * не перекрывает весь экран. Здесь же, после выбора, позже подключается
 * аналитика — и только тех категорий, которые разрешил посетитель.
 */
export function CookieBanner() {
  const t = useTranslations("cookies");
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    // Согласие уже есть — баннер не показываем никогда.
    if (readConsent()) return;
    // Небольшая задержка: страница сначала плавно открывается, баннер
    // появляется следом и не дёргает вёрстку.
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const acceptAll = () => {
    writeConsent({ necessary: true, analytics: true, marketing: true, functional: true });
    // Здесь можно инициализировать аналитику (например, Google Analytics).
    setIsVisible(false);
  };

  const rejectAll = () => {
    writeConsent(DEFAULT_PREFERENCES);
    setIsVisible(false);
  };

  const savePreferences = () => {
    writeConsent(preferences);
    setIsVisible(false);
  };

  const togglePreference = (key: keyof ConsentPreferences) => {
    // Необходимые cookie нельзя отключить.
    if (key === "necessary") return;
    setPreferences((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  if (!isVisible) return null;

  const toggles: Array<{ key: keyof ConsentPreferences; label: string; description: string }> = [
    { key: "analytics", label: t("analytics"), description: t("analyticsDesc") },
    { key: "marketing", label: t("marketing"), description: t("marketingDesc") },
    { key: "functional", label: t("functional"), description: t("functionalDesc") },
  ];

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-[var(--mobile-bottom-nav-clearance)] z-50 p-4 animate-in fade-in slide-in-from-bottom-6 duration-300 lg:bottom-0"
    >
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Основная часть */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Cookie aria-hidden="true" className="h-6 w-6" />
                {t("title")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.rich("body", {
                  link: (chunks) => (
                    <a
                      href="/privacy"
                      className="underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
            {/* Крестик: баннер легко закрыть, не делая выбор. */}
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              aria-label={t("close")}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={acceptAll}>{t("acceptAll")}</Button>
            <Button onClick={rejectAll} variant="outline">
              {t("rejectAll")}
            </Button>
            <Button
              onClick={() => setShowDetails((value) => !value)}
              variant="ghost"
              className="gap-2"
              aria-expanded={showDetails}
            >
              <Settings aria-hidden="true" className="size-4" />
              {t("customize")}
            </Button>
          </div>
        </div>

        {/* Детальные настройки (раскрываются по «Настроить») */}
        {showDetails ? (
          <div className="border-t border-border bg-muted/40 p-6">
            <h4 className="font-semibold">{t("preferencesTitle")}</h4>

            <div className="mt-4 space-y-4">
              {/* Необходимые — всегда включены, без переключателя */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{t("necessary")}</div>
                  <div className="text-xs text-muted-foreground">{t("necessaryDesc")}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Check aria-hidden="true" className="size-4 text-emerald-500" />
                  <span className="text-sm">{t("alwaysOn")}</span>
                </div>
              </div>

              {toggles.map(({ key, label, description }) => {
                const enabled = preferences[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={label}
                      onClick={() => togglePreference(key)}
                      className={`h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                        enabled ? "bg-primary" : "bg-muted-foreground/40"
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-background shadow transition-transform duration-200 ${
                          enabled ? "translate-x-[1.375rem]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={savePreferences}>{t("save")}</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
