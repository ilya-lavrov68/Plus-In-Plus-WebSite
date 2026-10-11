import { ArrowLeft, ArrowRight, ArrowUpRight, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { SafeImage } from "@/components/site/safe-image";
import { getPublishedPost, getPublishedPosts, toNewsItem } from "@/lib/data";
import { SAMPLE_ARTICLE } from "@/lib/blog-sample-article";
import { createPageMetadata } from "@/lib/seo";
import { sanitizePostContent } from "@/lib/sanitize-post-content";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

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

function ArticleTitleRow({ title, meta }: { title: string; meta: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex min-w-0 items-center gap-4">
        {/* Decorative source icons from the design (YouTube + arrow). */}
        <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-2">
          <span className="inline-flex h-7 w-9 items-center justify-center rounded-lg bg-[#052B42]/[0.06]">
            <Play className="h-3.5 w-3.5 fill-[#e62117] text-[#e62117]" />
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#052B42]/[0.06]">
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.7} />
          </span>
        </span>
        <h2 className="font-geist text-3xl font-normal tracking-tight sm:text-5xl">{title}</h2>
      </div>
      {meta && <p className="text-base text-[#052B42]">{meta}</p>}
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
      {direction === "prev" && <ArrowLeft aria-hidden="true" className="h-5 w-5" />}
      {children}
      {direction === "next" && <ArrowRight aria-hidden="true" className="h-5 w-5" />}
    </>
  );
  const className =
    "inline-flex items-center gap-2 rounded-sm text-lg font-semibold underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

  if (!href) {
    return (
      <span aria-disabled="true" className={`${className} opacity-40`}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} className={`${className} hover:underline`}>
      {content}
    </Link>
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, allPosts] = await Promise.all([getPublishedPost(slug), getPublishedPosts()]);
  if (!post) redirect("/blog");

  // Posts are sorted newest first: "Previous" is the older post, "Next" the newer one.
  const index = allPosts.findIndex((item) => item.slug === post.slug);
  const newer = index > 0 ? allPosts[index - 1] : null;
  const older = index >= 0 && index < allPosts.length - 1 ? allPosts[index + 1] : null;
  const newsItems = allPosts.filter((item) => item.slug !== post.slug).map(toNewsItem);

  const hasBody = post.content.trim().length > 0;
  const dateLabel = post.publishedAt ? DATE_FORMAT.format(post.publishedAt) : "";
  const meta = [dateLabel, `${post.readTime}-minute read`].filter(Boolean).join(" · ");

  const navigation = (
    <nav aria-label="Post navigation" className="mt-14 flex items-center justify-between gap-4">
      <PostNavLink href={older ? `/blog/${older.slug}` : null} direction="prev">
        Previous
      </PostNavLink>
      <PostNavLink href={newer ? `/blog/${newer.slug}` : null} direction="next">
        Next
      </PostNavLink>
    </nav>
  );

  return (
    <>
      <InternalPageHeader title="BLOG" />

      <InternalPageContent>
        <article className="text-[#052B42]">
          <ArticleTitleRow title={post.title} meta={meta} />

          {post.coverImage && (
            <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-2xl">
              <SafeImage
                src={post.coverImage}
                alt=""
                fill
                priority
                sizes="(min-width: 1280px) 1100px, 100vw"
                className="object-cover"
              />
            </div>
          )}

          {hasBody ? (
            <>
              {post.excerpt && (
                <p className="mt-10 text-lg leading-relaxed">{post.excerpt}</p>
              )}
              <div
                className="article-content mt-8"
                dangerouslySetInnerHTML={{ __html: sanitizePostContent(post.content) }}
              />
            </>
          ) : (
            <div className="mt-10 space-y-8 text-lg leading-relaxed">
              <p>{SAMPLE_ARTICLE.lead}</p>
              {SAMPLE_ARTICLE.sections.map((section, sectionIndex) => {
                const headingId = `article-section-${sectionIndex}`;
                return (
                  <section key={section.title} aria-labelledby={headingId}>
                    <h2 id={headingId} className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <h3 className="mt-3 text-xl font-semibold leading-snug">{section.subtitle}</h3>
                    )}
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex} className="mt-4">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                );
              })}
              <p className="pt-2 text-xl font-semibold">{SAMPLE_ARTICLE.closing}</p>
            </div>
          )}
        </article>

        {navigation}
      </InternalPageContent>

      <OtherNewsSection items={newsItems} id="post-other-news" />
    </>
  );
}
