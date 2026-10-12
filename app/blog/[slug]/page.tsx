import { ArrowLeft, ArrowRight, ArrowUpRight, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { PostGallery } from "@/components/site/post-gallery";
import { getPublishedPost, getPublishedPosts, toNewsItem } from "@/lib/data";
import { isSampleArticle, sampleArticleCopy } from "@/lib/blog-sample-article";
import { createPageMetadata, SITE_URL } from "@/lib/seo";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import { formatPublishedDate, type Locale } from "@/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import type { MessageTranslator } from "@/lib/i18n-messages";

export const dynamic = "force-dynamic";


interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [post, t, locale] = await Promise.all([
    getPublishedPost(slug),
    getRequestTranslations("metadata"),
    getRequestLocale(),
  ]);
  const title = post ? `${post.title} — Plus In Plus` : t("blog");

  return createPageMetadata({
    title,
    description: post?.excerpt || t("blogDescription"),
    path: `/blog/${encodeURIComponent(slug)}`,
    image: post?.coverImage,
    type: "article",
    publishedTime: post?.publishedAt,
    locale,
  });
}

function SourceIcon({ source }: { source: "vk" | "telegram" | "youtube" }) {
  if (source === "telegram") return <Send aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.9} />;
  if (source === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  return <span aria-hidden="true" className="text-sm font-extrabold lowercase tracking-[-0.08em]">vk</span>;
}

function safeExternalUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== SITE_URL.origin;
  } catch {
    return false;
  }
}

function ArticleTitleRow({
  t,
  title,
  meta,
  dateTime,
  source,
  sourceUrl,
}: {
  t: MessageTranslator;
  title: string;
  meta: string;
  dateTime?: string;
  source?: string;
  sourceUrl?: string | null;
}) {
  const normalizedSource = source?.trim().toLowerCase();
  const socialSource = normalizedSource === "vk" || normalizedSource === "telegram" || normalizedSource === "youtube"
    ? normalizedSource
    : null;
  const externalSourceUrl = safeExternalUrl(sourceUrl) ? sourceUrl : null;
  return (
    <header className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-5 gap-y-3 px-5 sm:px-8 lg:px-10">
      <span className="flex shrink-0 items-center gap-2" aria-label={t("originalPostLinks")}>
        {socialSource && externalSourceUrl ? (
          <a
            href={externalSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("openSource", { source: socialSource === "vk" ? "VK" : socialSource === "telegram" ? "Telegram" : "YouTube" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#052B42]/20 bg-white text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            <SourceIcon source={socialSource} />
          </a>
        ) : null}
        {externalSourceUrl ? (
          <a
            href={externalSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("openOriginalPost")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#052B42]/20 bg-white text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            <ArrowUpRight aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </a>
        ) : null}
      </span>
      <h2 className="min-w-0 flex-1 font-geist text-[clamp(2rem,4vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.05em] text-[#052B42]">
        {title}
      </h2>
      {meta ? (
        <time dateTime={dateTime} className="w-full shrink-0 font-body text-xs font-medium text-[#052B42] sm:ml-auto sm:w-auto sm:text-sm lg:text-base">
          {meta}
        </time>
      ) : null}
    </header>
  );
}

function PostNavLink({
  href,
  direction,
  children,
}: {
  href: string | null;
  direction: "prev" | "next";
  children: React.ReactNode;
}) {
  const content = (
    <>
      {direction === "prev" ? <ArrowLeft aria-hidden="true" className="h-4 w-4" /> : null}
      {children}
      {direction === "next" ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
    </>
  );
  const className = "inline-flex items-center gap-2 rounded-sm font-body text-sm font-semibold underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] sm:text-base";

  if (!href) {
    return <span aria-disabled="true" className={`${className} opacity-40`}>{content}</span>;
  }
  return <Link href={href} className={`${className} hover:underline`}>{content}</Link>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, allPosts, t] = await Promise.all([
    getPublishedPost(slug),
    getPublishedPosts(),
    getRequestTranslations("blog"),
  ]);
  if (!post) redirect("/blog");

  const referenceArticle = isSampleArticle(post);
  // The design's canonical article copy is used only for its matching published post.
  const showReferenceCopy = referenceArticle;
  const sampleArticle = sampleArticleCopy(t);
  const displayTitle = referenceArticle ? sampleArticle.title : post.title;
  const index = allPosts.findIndex((item) => item.slug === post.slug);
  const newer = index > 0 ? allPosts[index - 1] : null;
  const older = index >= 0 && index < allPosts.length - 1 ? allPosts[index + 1] : null;
  const newsItems = allPosts.filter((item) => item.slug !== post.slug).map(toNewsItem);
  const locale: Locale = await getRequestLocale();
  const date = post.publishedAt ?? post.createdAt;
  const readTime = referenceArticle ? 4 : post.readTime;
  const meta = [date ? formatPublishedDate(date, locale) : "", t("readTime", { count: readTime })].filter(Boolean).join(" · ");
  const dateTime = date?.toISOString();
  const hasBody = post.content.trim().length > 0;

  const navigation = (
    <nav aria-label={t("postNavigation")} className="mt-10 flex items-center justify-between gap-4 border-t border-[#052B42]/10 pt-6 sm:mt-12">
      <PostNavLink href={older ? `/blog/${older.slug}` : null} direction="prev">{t("previous")}</PostNavLink>
      <PostNavLink href={newer ? `/blog/${newer.slug}` : null} direction="next">{t("next")}</PostNavLink>
    </nav>
  );

  return (
    <>
      <InternalPageHeader title={t("pageTitle")} />

      <section className="rounded-t-[3.5rem] bg-[#CFE0FF] pb-0 pt-[clamp(4rem,9.55vw,11.5rem)] text-[#052B42] sm:rounded-t-[4rem] lg:rounded-t-[100px]">
        <ArticleTitleRow
          t={t}
          title={displayTitle}
          meta={meta}
          dateTime={dateTime}
          source={post.source}
          sourceUrl={post.sourceUrl}
        />

        <article className="mx-auto mt-5 w-full max-w-[1920px] rounded-[2.5rem] bg-white px-5 py-7 text-[#052B42] sm:mt-6 sm:rounded-[3.5rem] sm:px-10 sm:py-10 lg:rounded-[100px] lg:px-[4.2%] lg:py-12">
          {showReferenceCopy ? (
            <div className="space-y-5 font-body text-sm leading-[1.4] sm:text-base sm:leading-[1.45]">
              <p>{sampleArticle.lead}</p>
              {sampleArticle.sections.map((section) => (
                <section key={section.title} aria-label={section.title}>
                  <h3 className="font-geist text-base font-semibold leading-snug sm:text-lg">
                    {section.title}
                  </h3>
                  {section.subtitle ? <p className="mt-1 font-semibold">{section.subtitle}</p> : null}
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} className="mt-1">{paragraph}</p>
                  ))}
                </section>
              ))}
              <p className="pt-1 text-base font-medium sm:text-lg">{sampleArticle.closing}</p>
            </div>
          ) : hasBody ? (
            <>
              {post.excerpt ? <p className="font-body text-sm leading-[1.4] sm:text-base sm:leading-[1.45]">{post.excerpt}</p> : null}
              <div
                className="article-content mt-5"
                dangerouslySetInnerHTML={{ __html: sanitizePostContent(post.content) }}
              />
            </>
          ) : post.excerpt ? (
            <p className="font-body text-sm leading-[1.4] sm:text-base sm:leading-[1.45]">{post.excerpt}</p>
          ) : (
            <EmptyState
              icon={ArrowUpRight}
              title={t("preparing.title")}
              description={t("preparing.description")}
            />
          )}

          {post.images ? <PostGallery images={post.images} /> : null}

          {navigation}
        </article>
      </section>

      <OtherNewsSection items={newsItems} id="post-other-news" />
    </>
  );
}
