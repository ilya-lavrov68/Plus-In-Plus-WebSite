"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("admin");
  return (
    <div role="alert" className="rounded-lg border p-8">
      <h1 className="text-xl font-semibold">{t("error.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.description")}</p>
      <Button type="button" className="mt-5" onClick={reset}>{t("error.tryAgain")}</Button>
    </div>
  );
}
