import { ArrowLeft, ArrowRight, ArrowUpRight, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { getPublishedPost, getPublishedPosts, toNewsItem } from "@/lib/data";
import { SAMPLE_ARTICLE } from "@/lib/blog-sample-article";
import { createPageMetadata } from "@/lib/seo";
import { sanitizePostContent } from "@/lib/sanitize-post-content";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const REFERENCE_ARTICLE_DATE = new Date("2026-10-07T00:00:00.000Z");

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  const title = post ? `${post.title} — Plus In Plus` : "Blog — Plus In Plus";

  return createPageMetadata({
    title,
    description: post?.excerpt || "News, ideas and design materials from the Plus In Plus team.",
    path: `/blog/${encodeURIComponent(slug)}`,
    image: post?.coverImage,
    type: "article",
    publishedTime: post?.publishedAt,
  });
}

function isReferenceArticle(post: { title: string; slug: string }) {
  const title = post.title.trim().replace(/[’‘]/g, "'").toLowerCase();
  const slug = post.slug.trim().toLowerCase();
  return title === SAMPLE_ARTICLE.title.toLowerCase() || ["we-re-up-and-running", "were-up-and-running"].includes(slug);
}

function ArticleTitleRow({ title, meta, dateTime }: { title: string; meta: string; dateTime?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-5 gap-y-3 px-5 sm:px-8 lg:px-10">
      <span aria-hidden="true" className="flex shrink-0 items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#052B42] sm:h-12 sm:w-12 lg:h-[60px] lg:w-[60px]">
          <span className="inline-flex h-[13px] w-[18px] items-center justify-center rounded-[4px] bg-[#052B42] lg:h-[18px] lg:w-6">
            <Play className="h-2.5 w-2.5 fill-white text-white lg:h-3 lg:w-3" />
          </span>
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#052B42] sm:h-12 sm:w-12 lg:h-[60px] lg:w-[60px]">
          <ArrowUpRight className="h-4 w-4 lg:h-7 lg:w-7" strokeWidth={1.8} />
        </span>
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
  const [post, allPosts] = await Promise.all([getPublishedPost(slug), getPublishedPosts()]);
  if (!post) redirect("/blog");

  const referenceArticle = isReferenceArticle(post);
  // The design's canonical article copy is used only for its matching published post.
  const showReferenceCopy = referenceArticle;
  const displayTitle = referenceArticle ? SAMPLE_ARTICLE.title : post.title;
  const index = allPosts.findIndex((item) => item.slug === post.slug);
  const newer = index > 0 ? allPosts[index - 1] : null;
  const older = index >= 0 && index < allPosts.length - 1 ? allPosts[index + 1] : null;
  const newsItems = allPosts.filter((item) => item.slug !== post.slug).map(toNewsItem);
  const date = referenceArticle ? REFERENCE_ARTICLE_DATE : post.publishedAt;
  const readTime = referenceArticle ? 4 : post.readTime;
  const meta = [date ? DATE_FORMAT.format(date) : "", `${readTime}-minute read`].filter(Boolean).join(" · ");
  const dateTime = date?.toISOString().slice(0, 10);
  const hasBody = post.content.trim().length > 0;

  const navigation = (
    <nav aria-label="Post navigation" className="mt-10 flex items-center justify-between gap-4 border-t border-[#052B42]/10 pt-6 sm:mt-12">
      <PostNavLink href={older ? `/blog/${older.slug}` : null} direction="prev">Previous</PostNavLink>
      <PostNavLink href={newer ? `/blog/${newer.slug}` : null} direction="next">Next</PostNavLink>
    </nav>
  );

  return (
    <>
      <InternalPageHeader title="BLOG" />

      <section className="rounded-t-[3.5rem] bg-[#CFE0FF] pb-0 pt-[clamp(4rem,9.55vw,11.5rem)] text-[#052B42] sm:rounded-t-[4rem] lg:rounded-t-[100px]">
        <ArticleTitleRow title={displayTitle} meta={meta} dateTime={dateTime} />

        <article className="mx-auto mt-5 w-full max-w-[1920px] rounded-[2.5rem] bg-white px-5 py-7 text-[#052B42] sm:mt-6 sm:rounded-[3.5rem] sm:px-10 sm:py-10 lg:rounded-[100px] lg:px-[4.2%] lg:py-12">
          {showReferenceCopy ? (
            <div className="space-y-5 font-body text-sm leading-[1.4] sm:text-base sm:leading-[1.45]">
              <p>{SAMPLE_ARTICLE.lead}</p>
              {SAMPLE_ARTICLE.sections.map((section) => (
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
              <p className="pt-1 text-base font-medium sm:text-lg">{SAMPLE_ARTICLE.closing}</p>
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
              title="This article is being prepared"
              description="Please check back soon for the full article."
            />
          )}

          {navigation}
        </article>
      </section>

      <OtherNewsSection items={newsItems} id="post-other-news" />
    </>
  );
}
