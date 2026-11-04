import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getRequestTranslations } from "@/lib/server-i18n";

export default async function NotFound() {
  const t = await getRequestTranslations("errors");

  return (
    <section className="container mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {t("notFound")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        {t("notFoundDescription")}
      </p>
      <Button size="lg" className="mt-8"asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </section>
  );
}
