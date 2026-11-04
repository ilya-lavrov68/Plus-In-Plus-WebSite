import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { STUDIO_BLOG_POSTS, type CatalogBlogPost } from "@/lib/studio-catalog";

export interface Blogpost11Props {
  post?: CatalogBlogPost;
  previousPost?: CatalogBlogPost | null;
  nextPost?: CatalogBlogPost | null;
  previousLabel?: string;
  nextLabel?: string;
  navigationLabel?: string;
}

const Blogpost11 = ({
  post = STUDIO_BLOG_POSTS[0],
  previousPost,
  nextPost,
  previousLabel = "Previous",
  nextLabel = "Next",
  navigationLabel = "Article navigation",
}: Blogpost11Props) => {
  return (
    <article className="section-y">
      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-border bg-muted lg:sticky lg:top-28">
              <img
                src={post.image}
                alt={post.title}
                className="aspect-[4/3] w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-sm text-muted-foreground">{post.metaLabel}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-6 text-lg leading-[1.75] text-muted-foreground">
              {post.lead}
            </p>

            {post.author ? (
              <div className="mt-8 flex items-center gap-3.5">
                <Avatar className="size-11 border border-border">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                    {post.author.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {post.author.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {post.author.role}
                  </div>
                </div>
              </div>
            ) : null}

            {post.author || post.quote?.trim() ? <Separator className="my-8" /> : null}

            {post.quote?.trim() ? (
              <figure className="rounded-xl border border-border bg-card p-6 md:p-8">
                <blockquote className="text-lg leading-[1.7] font-medium text-foreground">
                  &ldquo;{post.quote}&rdquo;
                </blockquote>
                {post.quoteAttribution && (
                  <figcaption className="mt-3 text-xs text-muted-foreground">
                    — {post.quoteAttribution}
                  </figcaption>
                )}
              </figure>
            ) : null}

            {!post.htmlContent && post.sections && post.sections.length > 0 ? (
              <div className="mt-14 space-y-12">
                {post.sections.map((section, idx) => (
                  <section key={idx} className="space-y-5">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-lg font-medium text-foreground/90">
                        {section.subtitle}
                      </p>
                    )}
                    {section.paragraphs.map((paragraph, pIdx) => (
                      <p
                        key={pIdx}
                        className="text-base leading-[1.8] text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
                {post.closing && (
                  <p className="pt-2 text-lg font-medium text-foreground">
                    {post.closing}
                  </p>
                )}
              </div>
            ) : post.htmlContent ? (
              <div
                className="article-content mt-10"
                dangerouslySetInnerHTML={{ __html: post.htmlContent }}
              />
            ) : null}

            {(previousPost || nextPost) && (
              <>
                <Separator className="my-12" />
                <nav
                  aria-label={navigationLabel}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  {previousPost ? (
                    <Button variant="outline" asChild>
                      <Link
                        href={`/blog/${previousPost.slug}`}
                        className="group"
                      >
                        <ArrowLeft className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
                        {previousLabel}
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}

                  {nextPost ? (
                    <Button variant="outline" asChild>
                      <Link href={`/blog/${nextPost.slug}`} className="group">
                        {nextLabel}
                        <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                </nav>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export { Blogpost11 };
