import type { MessageTranslator } from "@/lib/i18n-messages";

/**
 * Reference article of the supplied Plus In Plus Blog PDF. The canonical title and
 * slugs are kept here in English for matching the published database post in both
 * languages; the copy itself lives in `messages/*.json` (`blog.sampleArticle.*`).
 */
export const SAMPLE_ARTICLE_TITLE = "We're Up and Running";
export const SAMPLE_ARTICLE_SLUGS = ["we-re-up-and-running", "were-up-and-running"];

export interface SampleArticleSection {
  title: string;
  subtitle?: string;
  paragraphs: string[];
}

export interface SampleArticle {
  title: string;
  lead: string;
  sections: SampleArticleSection[];
  closing: string;
}

/** True when a published post is the reference article of the blog mockup. */
export function isSampleArticle(post: { title: string; slug: string }): boolean {
  const title = post.title.trim().replace(/[’‘]/g, "'").toLowerCase();
  const slug = post.slug.trim().toLowerCase();
  return title === SAMPLE_ARTICLE_TITLE.toLowerCase() || SAMPLE_ARTICLE_SLUGS.includes(slug);
}

/** Localised copy of the reference article. */
export function sampleArticleCopy(t: MessageTranslator): SampleArticle {
  const sections = (t.raw("sampleArticle.sections") ?? []) as SampleArticleSection[];
  return {
    title: t("sampleArticle.title"),
    lead: t("sampleArticle.lead"),
    sections: Array.isArray(sections) ? sections : [],
    closing: t("sampleArticle.closing"),
  };
}
