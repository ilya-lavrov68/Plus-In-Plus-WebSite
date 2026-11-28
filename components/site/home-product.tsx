import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { HoverGlow } from "@/components/site/hover-glow";
import { Button } from "@/components/ui/button";
import { PRODUCTS, productTagline } from "@/lib/products";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import {
  listPublishedStudioProducts,
  studioProductPath,
  type StudioProduct,
} from "@/lib/studio-products";

/**
 * Продукт студии на главной.
 *
 * Блок устроен как первый экран продуктовой страницы: имя, одна строка о
 * назначении, версия и действия. Источник — админка: опубликовали продукт,
 * он вышел на главную. Пока в базе пусто, показывается Line Launcher из
 * статического реестра — главная не остаётся без продукта.
 */

interface ProductTeaser {
  name: string;
  tagline: string;
  badge?: string;
  status?: string;
  href: string;
  repoUrl?: string;
  screenshot?: { src: string; alt: string };
}

const LAUNCHER_SCREENSHOT = {
  src: "/assets/line-launcher/line-servers.webp",
  alt: "Интерфейс Line Launcher: список серверов",
};

function teaserFromRecord(product: StudioProduct, locale: string): ProductTeaser {
  return {
    name: product.name,
    tagline:
      (locale === "en" ? product.taglineEn || product.taglineRu : product.taglineRu || product.taglineEn) ||
      product.name,
    badge: product.version || undefined,
    status: product.statusLabel || undefined,
    href: studioProductPath(product),
    repoUrl: product.repoUrl || undefined,
    // Скриншот показываем только там, где он действительно есть.
    screenshot: product.slug === "line-launcher" ? LAUNCHER_SCREENSHOT : undefined,
  };
}

function teaserFromRegistry(locale: string): ProductTeaser {
  const entry = PRODUCTS[0];
  return {
    name: entry.name,
    tagline: productTagline(entry, locale),
    badge: entry.badge,
    href: entry.href,
    repoUrl: "https://github.com/ilya-lavrov68/Line-Launcher",
    screenshot: LAUNCHER_SCREENSHOT,
  };
}

export async function HomeProduct() {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("productPage"),
  ]);

  let teaser: ProductTeaser;
  try {
    const [first] = await listPublishedStudioProducts();
    teaser = first ? teaserFromRecord(first, locale) : teaserFromRegistry(locale);
  } catch {
    // Витрина не должна ронять главную: упала база — показываем реестр.
    teaser = teaserFromRegistry(locale);
  }

  return (
    // Верхний отступ даёт воздух после первого экрана, нижний не дублирует
    // шаг следующей секции.
    <section className="pt-[clamp(3.5rem,2.5rem+4vw,6rem)]">
      <div className="container">
        <div className="relative overflow-hidden bg-card">
          <HoverGlow pattern={`product:${teaser.href}`} intensity={0.32} />

          <div className="relative z-10 grid items-center gap-8 p-6 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:p-10">
            <div>
              <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
                <Link href={teaser.href} className="transition-colors hover:text-primary">
                  {teaser.name}
                </Link>
              </h2>

              <p className="measure mt-4 text-base leading-[1.7] text-muted-foreground md:text-lg">
                {teaser.tagline}
              </p>

              {teaser.status || teaser.badge ? (
                <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  {teaser.status ? (
                    <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                      {teaser.status}
                    </span>
                  ) : null}
                  {teaser.badge ? (
                    <span className="font-medium tabular-nums text-muted-foreground">{teaser.badge}</span>
                  ) : null}
                </p>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="primary">
                  <Link href={teaser.href} className="group">
                    {t("openProduct")}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="ml-1 size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </Link>
                </Button>

                {teaser.repoUrl ? (
                  <Button asChild size="lg" variant="neutral">
                    <a href={teaser.repoUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink aria-hidden="true" />
                      {t("repoCta")}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {teaser.screenshot ? (
              <Link
                href={teaser.href}
                aria-label={teaser.name}
                className="block overflow-hidden bg-white/[0.04]"
              >
                <Image
                  src={teaser.screenshot.src}
                  alt={teaser.screenshot.alt}
                  width={1600}
                  height={900}
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="h-auto w-full object-cover"
                />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
