import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { PageGlow } from "@/components/site/page-glow";
import { ProductDownloads } from "@/components/site/product-downloads";
import { Button } from "@/components/ui/button";
import { formatChangelogDate, type ChangelogData } from "@/lib/changelog-format";
import { HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import type { StudioProduct } from "@/lib/studio-products";

/**
 * Страница продукта по шаблону Line Launcher.
 *
 * Порядок секций повторяет эталон продуктовой страницы: первый экран →
 * «Что нового» из репозитория → «Что это» → призыв. Новый продукт из админки
 * получает эту же страницу без единой строки кода: всё, что здесь есть, взято
 * из записи продукта и его синхронизированной истории версий.
 */
export async function ProductTemplateView({ product }: { product: StudioProduct }) {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("productPage"),
  ]);

  const tagline = locale === "en" ? product.taglineEn || product.taglineRu : product.taglineRu || product.taglineEn;
  const summary = locale === "en" ? product.summaryEn || product.summaryRu : product.summaryRu || product.summaryEn;
  const changelog = product.changelog as ChangelogData | null;
  const recent = changelog?.entries.slice(0, 3) ?? [];

  return (
    <div className="relative isolate bg-background">
      <PageGlow
        preset="software"
        link={product.backgroundUrl}
        variant="ascii"
        cell={HAZEGLOW_CELL.ascii}
      />

      <section className="relative pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="container relative z-10">
          <div className="bg-card px-6 py-8 md:px-10 md:py-12">
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl">
              {product.name}
            </h1>

            {tagline ? (
              <p className="measure mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {tagline}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/contact">{t("contactCta")}</Link>
              </Button>

              {product.repoUrl ? (
                <Button asChild size="lg" variant="neutral">
                  <a href={product.repoUrl} target="_blank" rel="noreferrer noopener">
                    <ExternalLink aria-hidden="true" />
                    {t("repoCta")}
                  </a>
                </Button>
              ) : null}

            </div>

            {product.statusLabel || product.version || product.facts.length > 0 ? (
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {product.statusLabel ? (
                  <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                    {product.statusLabel}
                  </span>
                ) : null}
                {product.version ? (
                  <span className="font-medium tabular-nums">{product.version}</span>
                ) : null}
                {product.facts.map((fact) => (
                  <span key={fact.value} className="font-medium text-muted-foreground">
                    {fact.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {product.downloads.length > 0 ? (
        <section className="relative pb-16 md:pb-20">
          <div className="container relative z-10">
            <ProductDownloads
              downloads={product.downloads}
              title={t("downloadCta")}
              version={product.version}
              locale={locale}
            />
          </div>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="relative pb-16 md:pb-20">
          <div className="container relative z-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-medium tracking-tight md:text-3xl">{t("whatsNew")}</h2>
              {changelog?.releasesUrl ? (
                <a
                  href={changelog.releasesUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70"
                >
                  {t("releases")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </a>
              ) : null}
            </div>

            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {recent.map((entry) => (
                <li key={entry.version} className="bg-card px-5 py-5">
                  <p className="flex items-baseline gap-3 text-sm">
                    <span className="font-medium tabular-nums">{entry.version}</span>
                    <span className="text-muted-foreground">
                      {formatChangelogDate(entry.date, locale)}
                    </span>
                  </p>
                  {entry.intro.length > 0 ? (
                    <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">
                      {entry.intro[0]}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {summary ? (
        <section className="relative pb-16 md:pb-20">
          <div className="container relative z-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <h2 className="text-2xl font-medium tracking-tight md:text-3xl">{t("aboutTitle")}</h2>
            <p className="measure text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {summary}
            </p>
          </div>
        </section>
      ) : null}

      {recent.length === 0 ? (
        <section className="relative pb-16 md:pb-20">
          <div className="container relative z-10">
            <p className="text-sm text-muted-foreground">{t("emptyChangelog")}</p>
          </div>
        </section>
      ) : null}

      <section className="relative pb-20 md:pb-28">
        <div className="container relative z-10 flex flex-wrap items-center justify-between gap-6 bg-card px-6 py-8 md:px-10">
          <p className="max-w-lg text-lg leading-snug">
            {tagline || product.name}
          </p>
          <Button asChild size="lg" variant="primary">
            <Link href="/contact">{t("contactCta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
