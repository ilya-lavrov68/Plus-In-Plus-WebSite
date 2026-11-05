"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Экран ошибки для всех страниц сайта.
 *
 * Ловит сбои дочерних сегментов, поэтому шапка, подвал и провайдеры остаются на
 * месте: посетитель видит объяснение и кнопку повтора вместо белого экрана.
 * Код ошибки (digest) показываем только когда Next его прислал — по нему
 * серверный инцидент находится в логах.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {t("serverError")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        {t("tryAgain")}
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground/80">
          {t("errorCode")}: {error.digest}
        </p>
      ) : null}
      <Button type="button" size="lg" onClick={reset} className="mt-8">
        {t("retryButton")}
      </Button>
    </section>
  );
}
