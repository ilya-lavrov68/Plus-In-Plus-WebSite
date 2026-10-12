import { Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import type { NewsItem } from "@/components/site/news-carousel";
import type { NewsItemView } from "@/lib/data";

export interface OtherNewsSectionProps {
  items: readonly NewsItemView[];
  /** Unique id used for the section heading (aria-labelledby). */
  id: string;
}

/** Shared light-blue carousel block used below internal-page content cards. */
export function OtherNewsSection({ items, id }: OtherNewsSectionProps) {
  const t = useTranslations("news");
  const carouselItems: NewsItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    href: item.href,
    postUrl: item.postUrl ?? item.href,
    sourceUrl: item.sourceUrl,
    imageSrc: item.imageSrc,
    excerpt: item.excerpt,
    source: item.source,
    imagesCount: item.imagesCount,
    publishedAt: item.publishedAt,
  }));

  return (
    <section aria-labelledby={id} className="bg-[#CFE0FF] text-[#052B42]">
      <div className="mx-auto max-w-[1836px] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 min-[1920px]:px-0 lg:pb-[56px] lg:pt-12">
        <h2 id={id} className="text-center font-geist text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[3rem]">
          {t("otherNews")}
        </h2>
        <div className="mt-8 sm:mt-10 lg:mt-10">
          {carouselItems.length ? (
            <NewsCarousel items={carouselItems} label={t("otherNewsLabel")} />
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
