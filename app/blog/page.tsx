import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/site/empty-state";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { getPublishedPosts } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { formatPostDate, type Locale } from "@/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: t("blog"),
    description: t("blogDescription"),
    path: "/blog",
    locale,
  });
}

export default async function BlogPage() {
  const [posts, t, locale] = await Promise.all([
    getPublishedPosts(),
    getRequestTranslations("blog"),
    getRequestLocale() as Promise<Locale>,
  ]);

  return (
    <>
      <InternalPageHeader title={t("pageTitle")} />

      <InternalPageContent labelledBy="blog-list-heading">
        <h2 id="blog-list-heading" className="sr-only font-semibold">
          {t("listHeading")}
        </h2>
        {posts.length ? (
          <ul className="divide-y divide-[#052B42]/15">
            {posts.map((post) => (
              <li key={post.id} className="py-6 first:pt-0 last:pb-0 sm:py-8">
                <article>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h3 className="font-geist text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="rounded-sm underline-offset-4 transition-colors duration-200 ease-out hover:text-[#0A4366] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    {post.publishedAt || post.createdAt ? (
                      <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()} className="font-body text-sm text-[#052B42]/75">
                        {formatPostDate(post.publishedAt ?? post.createdAt, locale)} · {t("readTime", { count: post.readTime })}
                      </time>
                    ) : null}
                  </div>
                  {post.excerpt ? <p className="mt-3 max-w-5xl font-body text-base leading-relaxed">{post.excerpt}</p> : null}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Newspaper}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        )}
      </InternalPageContent>
    </>
  );
}
