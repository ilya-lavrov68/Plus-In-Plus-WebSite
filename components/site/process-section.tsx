import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProcessSteps, type ProcessStep } from "@/components/site/process-steps";
import { Button } from "@/components/ui/button";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * Блок «Как мы работаем» для главной. Источник текстов — словарь `studio`,
 * чтобы описание процесса не расходилось со страницей студии.
 */
export async function ProcessSection() {
  const t = await getRequestTranslations("studio");
  const steps = t.raw("process") as ProcessStep[];

  return (
    <section className="section-y bg-muted/40">
      <div className="container">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {t("eyebrow")}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {t("processTitle")}
            </h2>
            <p className="mt-4 text-base leading-[1.75] text-muted-foreground">
              {t("processLead")}
            </p>
          </div>
          <Button asChild variant="neutral">
            <Link href="/studio" className="gap-2">
              {t("processAll")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>

        <ProcessSteps steps={steps} className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  );
}
