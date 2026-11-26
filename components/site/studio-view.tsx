import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CtaSection } from "@/components/site/cta-section";
import { ProcessSteps, type ProcessStep } from "@/components/site/process-steps";
import { Story } from "@/components/site/story";
import { Button } from "@/components/ui/button";
import { getRequestTranslations } from "@/lib/server-i18n";

interface Principle {
  title: string;
  body: string;
}

/**
 * Страница «Студия»: кто мы, принципы, процесс, партнёр и продукт.
 *
 * Никаких выдуманных сотрудников, наград и цифр: только то, что подтверждается
 * проектом — практика, партнёр TS Connect и собственный продукт Line Launcher.
 */
export async function StudioView() {
  const [t, tf] = await Promise.all([
    getRequestTranslations("studio"),
    getRequestTranslations("features"),
  ]);

  const principles: Principle[] = [
    { title: tf("confidential.title"), body: tf("confidential.description") },
    { title: tf("individual.title"), body: tf("individual.description") },
    { title: tf("support.title"), body: tf("support.description") },
  ];
  const process = t.raw("process") as ProcessStep[];

  return (
    <div className="bg-background">
      <section className="container section-y">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl">
          {t("title")}
        </h1>
        <p className="measure mt-6 text-base leading-[1.75] text-muted-foreground md:text-lg">
          {t("lead")}
        </p>

        <dl className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(t.raw("facts") as Array<{ label: string; value: string }>).map((fact) => (
            <div key={fact.label} className="rounded-xl bg-white/[0.045] p-5">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {fact.label}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container section-y-tight">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t("principlesTitle")}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {principles.map((principle) => (
            <div
              key={principle.title}
              data-reveal=""
              className="flex flex-col gap-3 rounded-2xl bg-white/[0.045] p-6"
            >
              <h3 className="text-lg font-medium tracking-tight">{principle.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Story />

      <section id="process" className="container section-y-tight">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("processTitle")}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("processLead")}
          </p>
        </div>
        <ProcessSteps steps={process} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" />
      </section>

      <section id="partners" className="container section-y-tight">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.045] p-8">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {t("partnersEyebrow")}
            </p>
            <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
              {t("partnersTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("partnersBody")}
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.045] p-8">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {t("productEyebrow")}
            </p>
            <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
              {t("productTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("productBody")}
            </p>
            <div className="mt-auto pt-2">
              <Button asChild variant="neutral">
                <Link href="/line-launcher" className="gap-2">
                  {t("productAction")}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
