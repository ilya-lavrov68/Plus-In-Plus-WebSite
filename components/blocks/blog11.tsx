"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Button } from "@/components/ui/button";
import type { BlogCardData } from "@/lib/blog-card";

export interface Blog11Props {
  id?: string;
  heading?: string;
  description?: string;
  posts?: BlogCardData[];
  asPageHeading?: boolean;
  allCategoryLabel?: string;
  categoryLabels?: Partial<Record<BlogCardData["category"], string>>;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Надзаголовок секции: «Журнал студии». */
  eyebrow?: string;
  /** Подпись главного материала. */
  featuredLabel?: string;
  /** Шаблон времени чтения с `{count}` — строки нельзя передать функцией. */
  readTimeTemplate?: string;
  /** Подпись ссылки в карточке. */
  readLabel?: string;
  /**
   * Блок призыва рядом с фильтром. Ссылка ведёт на форму контактов, поэтому
   * это честный CTA, а не подписка на рассылку, которой у студии нет.
   */
  ctaTitle?: string;
  ctaDescription?: string;
  ctaAction?: string;
  ctaHref?: string;
  /** Компактный режим — для блоков «другие материалы» на страницах статьи и услуги. */
  compact?: boolean;
  /** Первый материал крупным кадром. В компактном режиме выключен. */
  featured?: boolean;
  emptyEyebrow?: string;
}

const CATEGORY_ORDER: Array<BlogCardData["category"]> = ["Design", "Studio", "Outdoor"];

function readTime(template: string, minutes: number) {
  return template.replace("{count}", String(minutes));
}

interface PostMetaProps {
  categoryLabel: string;
  dateLabel: string;
  minutes: number;
  readTimeTemplate: string;
  tone?: "default" | "inverted";
}

function PostMeta({
  categoryLabel,
  dateLabel,
  minutes,
  readTimeTemplate,
  tone = "default",
}: PostMetaProps) {
  const muted = tone === "inverted" ? "text-white/70" : "text-muted-foreground";
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-[0.12em] uppercase ${muted}`}>
      <span>{categoryLabel}</span>
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <time className="tracking-normal normal-case">{dateLabel}</time>
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <span className="tracking-normal normal-case">{readTime(readTimeTemplate, minutes)}</span>
    </div>
  );
}

const Blog11 = ({
  id,
  heading = "Blog",
  description = "Latest news, studio updates, and design stories from Plus In Plus.",
  posts = [],
  asPageHeading = false,
  allCategoryLabel = "All",
  categoryLabels = {},
  emptyTitle = "The blog is empty",
  emptyDescription = "Our first article is coming soon.",
  eyebrow,
  featuredLabel = "Featured story",
  readTimeTemplate = "{count} min read",
  readLabel = "Read",
  ctaTitle,
  ctaDescription,
  ctaAction,
  ctaHref = "/contact",
  compact = false,
  featured,
  emptyEyebrow,
}: Blog11Props) => {
  const showFeatured = featured ?? !compact;

  const categories = useMemo<string[]>(() => {
    const present = new Set(posts.map((post) => post.category));
    const ordered: string[] = CATEGORY_ORDER.filter((category) => present.has(category));
    // В CMS может появиться новая рубрика: она попадает в фильтр без правки кода.
    for (const post of posts) {
      if (!ordered.includes(post.category)) ordered.push(post.category);
    }
    return ["All", ...ordered];
  }, [posts]);

  const [activeCategory, setActiveCategory] = useState("All");
  const selectedCategory = categories.includes(activeCategory) ? activeCategory : "All";

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "All") return posts;
    return posts.filter((post) => post.category === selectedCategory);
  }, [selectedCategory, posts]);

  const showLead = showFeatured && selectedCategory === "All" && filteredPosts.length > 1;
  const leadPost = showLead ? filteredPosts[0] : null;
  const gridPosts = showLead ? filteredPosts.slice(1) : filteredPosts;
  const categoryLabel = (category: string) =>
    categoryLabels[category as BlogCardData["category"]] ?? category;

  const HeadingTag = asPageHeading ? "h1" : "h2";

  return (
    <section id={id} className="motion-section section-y bg-background">
      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className={compact ? "lg:col-span-12" : "lg:col-span-3"}>
            <div className={compact ? "" : "lg:sticky lg:top-28"}>
              {eyebrow ? (
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <HeadingTag
                className={`text-4xl font-semibold tracking-tight md:text-5xl ${eyebrow ? "mt-4" : ""}`}
              >
                <DecryptText text={heading} seed={37} />
              </HeadingTag>
              {description ? (
                <p
                  data-reveal=""
                  data-reveal-delay={60}
                  className={`mt-5 max-w-xl text-base leading-[1.75] text-muted-foreground ${
                    compact ? "" : "lg:max-w-none"
                  }`}
                >
                  {description}
                </p>
              ) : null}

              {posts.length > 0 ? (
                <div
                  data-reveal=""
                  data-reveal-delay={100}
                  className={`flex flex-wrap gap-x-5 gap-y-3 lg:flex-col lg:gap-3.5 ${
                    compact ? "mt-8" : "mt-8"
                  }`}
                >
                  {categories.map((category) => {
                    const isActive = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        aria-pressed={isActive}
                        className={`relative w-fit pb-1 text-left text-xs font-medium tracking-wider uppercase transition-colors duration-200 ${
                          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {category === "All" ? allCategoryLabel : categoryLabel(category)}
                        {/* Подчёркивание активной категории — CSS-переход вместо
                            layout-анимации motion: та тянула ~130 КБ JS на каждую
                            страницу с блогом ради одной линии. */}
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-foreground transition-opacity duration-200 ease-out ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {!compact && ctaTitle && posts.length > 0 ? (
                <div
                  data-reveal=""
                  data-reveal-delay={140}
                  className="mt-10 hidden rounded-2xl bg-card p-6 lg:block"
                >
                  <p className="text-base font-medium text-foreground">{ctaTitle}</p>
                  {ctaDescription ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ctaDescription}</p>
                  ) : null}
                  {ctaAction ? (
                    <Button asChild variant="neutral" size="sm" className="mt-5">
                      <Link href={ctaHref}>{ctaAction}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className={compact ? "lg:col-span-12" : "lg:col-span-9"}>
            {posts.length === 0 ? (
              /*
                Пустой журнал — это текст, а не «плашка со свечением». Шумный
                Hazeglow здесь мешал читать и создавал ложное ощущение
                контента; остаются воздух, крупный заголовок и честные рубрики.
              */
              <div data-reveal="" className="flex flex-col gap-6 py-4 sm:py-8">
                <div className="max-w-xl">
                  {emptyEyebrow ? (
                    <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                      {emptyEyebrow}
                    </p>
                  ) : null}
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                    {emptyTitle}
                  </h3>
                  <p className="mt-4 text-base leading-[1.75] text-muted-foreground">
                    {emptyDescription}
                  </p>
                  {ctaAction ? (
                    <div className="mt-6">
                      <Button asChild size="lg">
                        <Link href={ctaHref}>
                          {ctaAction}
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Рубрики показывают, о чём будет журнал: реальная
                    таксономия студии, а не придуманные темы. */}
                <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {CATEGORY_ORDER.map((category) => (
                    <li key={category} className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="size-1 rounded-full bg-signal" />
                      {categoryLabels?.[category] ?? category}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-8">
                {leadPost ? (
                  <article data-reveal="">
                    <Link
                      href={`/blog/${leadPost.slug}`}
                      className="group grid overflow-hidden rounded-2xl bg-card transition-colors duration-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:grid-cols-[1.15fr_1fr]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted md:aspect-auto md:min-h-[19rem]">
                        <img
                          src={leadPost.image}
                          alt=""
                          className="size-full object-cover object-center"
                        />
                      </div>
                      <div className="flex flex-col justify-between gap-8 p-7 sm:p-10">
                        <div className="flex flex-col gap-5">
                          <span className="w-fit rounded-full bg-signal/12 px-3 py-1 text-xs font-medium text-signal">
                            {featuredLabel}
                          </span>
                          <h3 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl md:text-4xl">
                            {leadPost.title}
                          </h3>
                          {leadPost.excerpt ? (
                            <p className="line-clamp-3 text-base leading-[1.75] text-muted-foreground">
                              {leadPost.excerpt}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <PostMeta
                            categoryLabel={categoryLabel(leadPost.category)}
                            dateLabel={leadPost.dateLabel}
                            minutes={leadPost.readTime}
                            readTimeTemplate={readTimeTemplate}
                          />
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            {readLabel}
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4 text-muted-foreground transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                            />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </article>
                ) : null}

                <div
                  className={`grid grid-cols-1 gap-7 sm:grid-cols-2 ${
                    compact ? "md:grid-cols-3" : "xl:grid-cols-2"
                  }`}
                >
                  {gridPosts.map((post, index) => (
                    <article
                      key={post.id}
                      data-reveal=""
                      data-reveal-delay={Math.min(index, 5) * 50}
                      className="h-full"
                    >
                      <Link
                        href={`/blog/${post.slug}`}
                        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-colors duration-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                          <img
                            src={post.image}
                            alt=""
                            className="size-full object-cover object-center"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-4 p-7">
                          <PostMeta
                            categoryLabel={categoryLabel(post.category)}
                            dateLabel={post.dateLabel}
                            minutes={post.readTime}
                            readTimeTemplate={readTimeTemplate}
                          />
                          <h3 className="text-xl leading-snug font-semibold tracking-tight">{post.title}</h3>
                          {post.excerpt ? (
                            <p className="line-clamp-2 text-sm leading-[1.7] text-muted-foreground">
                              {post.excerpt}
                            </p>
                          ) : null}
                          <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-medium text-foreground">
                            {readLabel}
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4 text-muted-foreground transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                            />
                          </span>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Blog11 };
