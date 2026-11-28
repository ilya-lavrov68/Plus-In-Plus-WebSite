import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import {
  LineLauncherDownload,
  type DownloadCopy,
} from "@/components/site/line-launcher-download";
import { InlineMarkdown } from "@/components/site/inline-markdown";
import { PageGlow } from "@/components/site/page-glow";
import { ProductDownloads } from "@/components/site/product-downloads";
import { Button } from "@/components/ui/button";
import { formatChangelogDate } from "@/lib/changelog-format";
import { getChangelog } from "@/lib/changelog";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { getStudioProductBySlug } from "@/lib/studio-products";

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
 * возможности, платформы и стек. Публичных релизов у проекта нет, поэтому панель
 * скачивания показывает структуру (версия × платформа × формат), но все форматы
 * помечены как неопубликованные, а кнопка скачивания неактивна.
 */
export async function LineLauncherView() {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("lineLauncher"),
  ]);

  const facts = t.raw("facts") as Fact[];
  const download = t.raw("download") as DownloadCopy;
  const features = t.raw("features") as Feature[];
  const gallery = t.raw("gallery") as Screenshot[];
  const whatsNew = t.raw("whatsNew") as { title: string; link: string };
  const links = t.raw("links") as {
    repo: string;
    issues: string;
    releases: string;
  };
  // Блок краткий и честный: записи берутся из той же истории версий, что и
  // страница changelog. Нет данных — нет и блока.
  const recent = getChangelog()?.entries.slice(0, 3) ?? [];

  // Загрузки приходят из админки: архив кода есть всегда, установщики появятся
  // после релиза. Если записи продукта нет (база только на чтение), остаётся
  // прежняя панель «версия × платформа × формат».
  const product = await getStudioProductBySlug("line-launcher").catch(() => null);

  return (
    <div className="relative isolate bg-background">
      {/* Один фон на всю страницу: без швов между секциями и без повторов. */}
      <PageGlow
        preset="software"
        link={product?.backgroundUrl ?? null}
        variant="ascii"
        cell={HAZEGLOW_CELL.ascii}
      />
      <section className="relative border-0 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="container relative z-10">
          <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            <div className="bg-card px-6 py-8 md:px-8 md:py-10">
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

              {/* Метаданные продукта — только значения, без служебных подписей
                  вроде «платформы» или «стек»: они дублировали смысл. */}
              <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {facts.map((fact) => (
                  <li key={fact.value} className="font-medium">
                    {fact.value}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {/* Первый экран показывает настоящий интерфейс, а не фоновую
                  графику: скриншот честнее и спокойнее любого паттерна. */}
              <div className="relative overflow-hidden bg-card p-2">
                <Image
                  src={`${SCREENSHOT_DIR}/line-server.webp`}
                  alt={gallery[2]?.alt ?? ""}
                  width={1600}
                  height={900}
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="w-full object-cover"
                />
              </div>
              <p className="mt-4 max-w-[26rem] bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                {t("buildBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-16 md:pb-20">
        <div className="container relative z-10">
          {product && product.downloads.length > 0 ? (
            <ProductDownloads
              downloads={product.downloads}
              title={download.title}
              version={product.version}
              locale={locale}
            />
          ) : (
            <LineLauncherDownload copy={download} />
          )}
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="relative pb-16 md:pb-20">
          <div className="container relative z-10">
            <div className="bg-card px-6 py-8 md:px-8 md:py-10">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                  {whatsNew.title}
                </h2>
                <Link
                  href="/line-launcher/changelog"
                  className="text-sm text-signal underline-offset-4 hover:underline"
                >
                  {whatsNew.link}
                </Link>
              </div>
              <ul className="mt-6 grid gap-5">
                {recent.map((entry) => (
                  <li
                    key={entry.version}
                    className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-6"
                  >
                    <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0.5">
                      <span className="font-mono text-sm text-foreground">
                        {entry.version}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatChangelogDate(entry.date, locale)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <InlineMarkdown
                        text={entry.intro[0] ?? entry.sections[0]?.title ?? ""}
                        repositoryUrl={REPOSITORY_URL}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-0 py-16 md:py-24">
        <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <h2 className="bg-card self-start px-6 py-6 text-2xl font-medium tracking-tight sm:text-3xl md:px-7">
            {t("whatTitle")}
          </h2>
          <div className="measure space-y-4 bg-card px-6 py-6 text-base leading-relaxed text-muted-foreground md:px-8 md:py-8">
            <p>{t("whatLead")}</p>
            <p>{t("whatBody")}</p>
          </div>
        </div>
        <div className="container mt-12">
          <div className="overflow-hidden bg-card">
            <div className="p-2">
              <Image
                src={`${SCREENSHOT_DIR}/line-servers.webp`}
                alt={gallery[1]?.alt ?? ""}
                width={1600}
                height={900}
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 md:py-24">
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

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="bg-card px-6 py-6 text-2xl font-medium tracking-tight sm:text-3xl md:px-7">
              {t("galleryTitle")}
            </h2>
            <p className="bg-card px-4 py-3 text-xs text-muted-foreground">
              {t("galleryNote")}
            </p>
          </div>
          <div className="mt-10 space-y-14">
            {gallery.map((shot) => (
              <figure
                key={shot.src}
                className="grid gap-4 lg:grid-cols-[0.3fr_0.7fr] lg:items-end lg:gap-10"
              >
                <figcaption className="bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground lg:mb-4">
                  {shot.caption}
                </figcaption>
                <div className="overflow-hidden bg-card">
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
        <div className="container grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 bg-card px-6 py-6 md:px-8 md:py-8">
            <h2 className="text-lg font-medium">{t("privacyTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("privacyBody")}
            </p>
          </div>
          <div className="flex flex-col gap-3 bg-card px-6 py-6 md:px-8 md:py-8">
            <h2 className="text-lg font-medium">{t("buildTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("buildBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="relative pb-16 md:pb-20">
        <div className="container relative z-10">
          {/* Полоса ссылок вместо JetBrains-трио: документации и сообщества у
              проекта нет, поэтому остаются только существующие адреса. */}
          <nav
            aria-label={t("linksLabel")}
            className="bg-card px-6 py-5 md:px-8"
          >
            <ul className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
              <li>
                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {links.repo}
                </a>
              </li>
              <li>
                <a
                  href={`${REPOSITORY_URL}/issues`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {links.issues}
                </a>
              </li>
              <li>
                <a
                  href={`${REPOSITORY_URL}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {links.releases}
                </a>
              </li>
              <li>
                <Link
                  href="/line-launcher/changelog"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {whatsNew.link}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </section>

      <section className="relative pb-20 md:pb-28">
        {/* Финальный призыв — типографика на фоне, без коробки. */}
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
