import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { SectionGlow } from "@/components/site/section-glow";
import { Button } from "@/components/ui/button";
import { HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { getRequestTranslations } from "@/lib/server-i18n";

const REPOSITORY_URL = "https://github.com/ilya-lavrov68/Line-Launcher";
const SCREENSHOT_DIR = "/assets/line-launcher";

interface Fact {
  label: string;
  value: string;
}

interface Feature {
  title: string;
  text: string;
}

interface Screenshot {
  src: string;
  caption: string;
  alt: string;
}

/**
 * Страница flagship-продукта.
 *
 * Все утверждения взяты из публичного репозитория Line Launcher: описание,
 * возможности, платформы и стек. Публичных релизов у проекта нет, поэтому
 * кнопки «Скачать» на странице нет — только репозиторий и контакт студии.
 */
export async function LineLauncherView() {
  const t = await getRequestTranslations("lineLauncher");

  const facts = t.raw("facts") as Fact[];
  const features = t.raw("features") as Feature[];
  const gallery = t.raw("gallery") as Screenshot[];

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden border-0 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="container relative z-10">
          <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            <div>
              <h1 className="text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl">
                {t("title")}
              </h1>
              <p className="measure mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("lead")}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="primary">
                  <Link href="/contact">{t("contactCta")}</Link>
                </Button>
                <Button asChild size="lg" variant="neutral">
                  <a
                    href={REPOSITORY_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink aria-hidden="true" />
                    {t("repoCta")}
                  </a>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                  {t("status")}
                </span>
                <Link
                  href="/line-launcher/changelog"
                  className="inline-flex items-center gap-1.5 text-sm text-foreground underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("changelogCta")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
                <p className="measure text-xs leading-relaxed text-muted-foreground">
                  {t("releaseNote")}
                </p>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex items-baseline gap-2">
                    <dt className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                      {fact.label}
                    </dt>
                    <dd className="font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              {/* Первый экран показывает настоящий интерфейс, а не фоновую
                  графику: скриншот честнее и спокойнее любого паттерна. */}
              <div className="relative overflow-hidden rounded-2xl bg-card [--pip-nest-gap:0.5rem] [--pip-radius-outer:var(--radius-2xl)] p-2">
                <Image
                  src={`${SCREENSHOT_DIR}/line-server.webp`}
                  alt={gallery[2]?.alt ?? ""}
                  width={1600}
                  height={900}
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="nested-radius w-full object-cover"
                />
              </div>
              <p className="mt-4 max-w-[26rem] text-sm leading-relaxed text-muted-foreground">
                {t("buildBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-0 bg-card/40 py-16 md:py-24">
        <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            {t("whatTitle")}
          </h2>
          <div className="measure space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>{t("whatLead")}</p>
            <p>{t("whatBody")}</p>
          </div>
        </div>
        <div className="container mt-12">
          <div className="overflow-hidden rounded-2xl bg-card [--pip-nest-gap:0.5rem] [--pip-radius-outer:var(--radius-2xl)]">
            <div className="p-2">
              <Image
                src={`${SCREENSHOT_DIR}/line-servers.webp`}
                alt={gallery[1]?.alt ?? ""}
                width={1600}
                height={900}
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="nested-radius w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-16 md:py-24">
        <SectionGlow
          variant="ascii"
          preset="software"
          cell={HAZEGLOW_CELL.ascii}
          mask={false}
          canvasFromPreset
          intensity={1}
        />
        <div className="container relative z-10">
          <h2 className="bg-card px-6 py-6 text-2xl font-medium tracking-tight sm:text-3xl md:px-7">
            {t("featuresTitle")}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="bg-card px-6 py-6 md:px-7 md:py-7"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-medium tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card/40 py-16 md:py-24">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {t("galleryTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("galleryNote")}</p>
          </div>
          <div className="mt-10 space-y-14">
            {gallery.map((shot) => (
              <figure
                key={shot.src}
                className="grid gap-4 lg:grid-cols-[0.3fr_0.7fr] lg:items-end lg:gap-10"
              >
                <figcaption className="text-sm leading-relaxed text-muted-foreground lg:pb-4">
                  {shot.caption}
                </figcaption>
                <div className="overflow-hidden bg-card/40">
                  <Image
                    src={`${SCREENSHOT_DIR}/${shot.src}.webp`}
                    alt={shot.alt}
                    width={1600}
                    height={900}
                    sizes="(min-width: 1024px) 900px, 100vw"
                    className="w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        {/* Две темы продукта — колонки с волосяной линией сверху, без карточек. */}
        <div className="container grid gap-10 pt-6 sm:grid-cols-2 sm:gap-16">
          <div className="flex flex-col gap-3 [background-image:linear-gradient(to_right,rgba(255,255,255,0.14),rgba(255,255,255,0))] [background-position:top] [background-repeat:no-repeat] [background-size:100%_1px] sm:pt-6">
            <h2 className="text-lg font-medium">{t("privacyTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("privacyBody")}
            </p>
          </div>
          <div className="flex flex-col gap-3 [background-image:linear-gradient(to_right,rgba(255,255,255,0.14),rgba(255,255,255,0))] [background-position:top] [background-repeat:no-repeat] [background-size:100%_1px] sm:pt-6">
            <h2 className="text-lg font-medium">{t("buildTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("buildBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20 md:pb-28">
        {/* Финальный призыв — типографика на фоне, без коробки. */}
        <SectionGlow
          variant="ascii"
          preset="software"
          cell={HAZEGLOW_CELL.ascii}
          mask={false}
          canvasFromPreset
          intensity={1}
        />
        <div className="container relative z-10 pt-12">
          <div className="grid gap-8 bg-card px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h2 className="max-w-2xl text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                {t("ctaTitle")}
              </h2>
              <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("ctaBody")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Button asChild size="lg" variant="primary">
                <Link href="/contact">
                  {t("ctaButton")}
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="neutral">
                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t("repoCta")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
