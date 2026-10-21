"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function GlobalError({
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
      <Button type="button" size="lg" onClick={reset} className="mt-8">
        {t("tryAgain")}
      </Button>
    </section>
  );
}
