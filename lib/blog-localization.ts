import type { CatalogBlogPost } from "@/lib/studio-catalog";
import type { MessageTranslator } from "@/lib/server-i18n";
import type { Locale } from "@/i18n";
import { formatPostDate } from "@/i18n";

/** Apply the fully authored launch-story translation without changing stored post data. */
export function localizeBlogPosts(
  posts: CatalogBlogPost[],
  t: MessageTranslator,
  locale: Locale,
): CatalogBlogPost[] {
  const sample = t.raw("sampleArticle") as {
    title?: string;
    lead?: string;
    closing?: string;
    sections?: Array<{ title: string; subtitle?: string; paragraphs: string[] }>;
  } | undefined;

  return posts.map((post) => {
    if (post.slug !== "we-re-up-and-running" && post.slug !== "were-up-and-running") {
      return {
        ...post,
        dateLabel: formatPostDate(post.dateLabel, locale),
        metaLabel: `${formatPostDate(post.dateLabel, locale)} · ${t("readTime", { count: post.readTime })}`,
      };
    }

    const date = formatPostDate("2026-10-07", locale);
    return {
      ...post,
      title: sample?.title ?? post.title,
      lead: sample?.lead ?? post.lead,
      excerpt: sample?.lead ?? post.excerpt,
      closing: sample?.closing ?? post.closing,
      sections: sample?.sections ?? post.sections,
      htmlContent: undefined,
      dateLabel: date,
      metaLabel: `${date} · ${t("readTime", { count: post.readTime })}`,
    };
  });
}
