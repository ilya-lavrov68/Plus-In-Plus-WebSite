import { Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import type { NewsItem } from "@/components/site/news-carousel";
import type { NewsSource } from "@/components/site/news-card";

export const NEWS_AUTOPLAY_INTERVAL = 7000;

export interface NewsSectionItem {
  id: string;
  title: string;
  excerpt: string;
  imageSrc?: string;
  source: NewsSource;
  href: string;
  postUrl?: string;
  sourceUrl?: string | null;
  imagesCount?: number;
  publishedAt?: string | null;
}

export function NewsSection({ items }: { items: readonly NewsSectionItem[] }) {
  const t = useTranslations("news");
  const carouselItems: NewsItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    imageSrc: item.imageSrc,
    source: item.source,
    href: item.href,
    postUrl: item.postUrl ?? item.href,
    sourceUrl: item.sourceUrl,
    imagesCount: item.imagesCount,
    publishedAt: item.publishedAt,
  }));

  return (
    <section id="news" aria-labelledby="news-heading" className="bg-[#CFE0FF] text-[#052B42]">
      <div className="mx-auto max-w-[1836px] px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 min-[1920px]:px-0 lg:pb-[62px] lg:pt-20">
        <h2
          id="news-heading"
          className="text-center text-balance font-geist text-3xl font-semibold tracking-[-0.045em] text-[#052B42] sm:text-4xl lg:text-[3rem]"
        >
          {t("title")}
        </h2>

        <div className="mt-10 sm:mt-12 lg:mt-[88px]">
          {carouselItems.length ? (
            <NewsCarousel items={carouselItems} label={t("latestNewsLabel")} />
          ) : (
            <EmptyState
              icon={Newspaper}
              title={t("noNewsYet")}
              description={t("checkBack")}
            />
          )}
        </div>
      </div>
    </section>
  );
}
