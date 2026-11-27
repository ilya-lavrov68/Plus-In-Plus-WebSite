import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CtaSection } from "@/components/site/cta-section";
import { Button } from "@/components/ui/button";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { getWorkCase, localizeWorkCase } from "@/lib/work-cases";

/**
 * Страница кейса: контекст → задача → что сделали → результат, затем галерея.
 * Содержимое живёт в `lib/work-cases.ts`, чтобы индекс и страница кейса не
 * расходились, а факты проверялись в одном месте.
 */
export async function WorkCaseView({ slug }: { slug: string }) {
  const item = getWorkCase(slug);
  if (!item) notFound();

  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("work"),
  ]);
  const view = localizeWorkCase(item, locale === "ru" ? "ru" : "en");

  return (
    <div className="bg-background">
      <article className="container section-y">
        <Link
          href="/work"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("back")}
        </Link>

        <header className="mt-8 max-w-4xl">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <span>{view.discipline}</span>
            <span className="tracking-normal normal-case">{view.year}</span>
          </p>
          <h1 className="mt-5 text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl">
            {view.title}
          </h1>
          <p className="measure mt-6 text-base leading-[1.75] text-muted-foreground md:text-lg">
            {view.lead}
          </p>
        </header>

        <div className="mt-10 overflow-hidden bg-white/[0.055] p-1.5 sm:p-2">
          <img
            src={view.cover}
            alt={view.coverAlt}
            className="aspect-[16/9] w-full object-cover object-top"
          />
        </div>

        <dl className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {view.facts.map((fact) => (
            <div key={fact.label} className="rounded-xl bg-white/[0.045] p-5">
              <dt className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {fact.label}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {t("caseEyebrow")}
            </p>
          </div>
          <div className="space-y-12 lg:col-span-8">
            {view.sections.map((section) => (
              <section key={section.title} data-reveal="">
                <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
                  {section.title}
                </h2>
                <p className="measure mt-4 text-base leading-[1.75] text-muted-foreground">
                  {section.body}
                </p>
                {section.bullets?.length ? (
                  <ul className="mt-6 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="text-base leading-relaxed">
                        <span className="text-foreground/90">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        {view.gallery.length > 0 ? (
          <div className="mt-20">
            <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
              {t("galleryTitle")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
              {view.gallery.map((image) => (
                <figure key={image.src} className="flex flex-col gap-3">
                  <div className="overflow-hidden bg-white/[0.05] p-1.5">
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[16/10] w-full bg-background object-contain"
                    />
                  </div>
                  {image.caption ? (
                    <figcaption className="text-sm text-muted-foreground">
                      {image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        {view.related.length > 0 ? (
          <div className="mt-16 flex flex-wrap gap-3">
            {view.related.map((link) => (
              <Button key={link.href} asChild variant="neutral">
                <Link href={link.href}>{link.label[locale === "ru" ? "ru" : "en"]}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </article>

      <CtaSection />
    </div>
  );
}
