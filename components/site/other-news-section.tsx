import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/site/empty-state";
import { NewsCarousel } from "@/components/site/news-carousel";
import type { NewsItemView } from "@/lib/data";

export interface OtherNewsSectionProps {
  items: readonly NewsItemView[];
  /** Unique id used for the section heading (aria-labelledby). */
  id: string;
}

/** "Other News" block shown below the white content card on internal pages. */
export function OtherNewsSection({ items, id }: OtherNewsSectionProps) {
  return (
    <section aria-labelledby={id} className="bg-[#D6E4FF] text-[#052B42]">
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-8 sm:pb-20">
        <h2 id={id} className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Other News
        </h2>
        <div className="mt-10 sm:mt-12">
          {items.length ? (
            <NewsCarousel items={items} label="Other news" />
          ) : (
            <EmptyState
              icon={Newspaper}
              title="No news yet"
              description="Check back later for updates."
            />
          )}
        </div>
      </div>
    </section>
  );
}
