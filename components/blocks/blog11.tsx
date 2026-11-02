"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/site/empty-state";
import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Separator } from "@/components/ui/separator";
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
}: Blog11Props) => {
  const layoutScope = id || heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(posts.map((post) => post.category)));
    return ["All", ...unique];
  }, [posts]);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const selectedCategory = categories.includes(activeCategory)
    ? activeCategory
    : "All";

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "All") return posts;
    return posts.filter((post) => post.category === selectedCategory);
  }, [selectedCategory, posts]);

  const HeadingTag = asPageHeading ? "h1" : "h2";

  return (
    <section id={id} className="motion-section py-32">
      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <HeadingTag className="text-4xl font-semibold tracking-tight md:text-5xl">
                <DecryptText text={heading} seed={37} />
              </HeadingTag>
              <p
                data-reveal=""
                data-reveal-delay={60}
                className="mt-4 text-base leading-relaxed text-muted-foreground"
              >
                {description}
              </p>
              <Separator className="my-8" />
              <div
                data-reveal=""
                data-reveal-delay={100}
                className="flex flex-wrap gap-5 lg:flex-col lg:gap-4"
              >
                {categories.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`relative w-fit pb-1 text-left text-xs font-medium tracking-wider uppercase transition-colors duration-200 ${
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {category === "All"
                        ? allCategoryLabel
                        : categoryLabels[category as BlogCardData["category"]] ?? category}
                      {isActive && (
                        <motion.span
                          layoutId={`blog11-category-${layoutScope}`}
                          transition={{
                            type: "spring",
                            stiffness: 480,
                            damping: 38,
                          }}
                          className="absolute inset-x-0 bottom-0 h-px bg-foreground"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8">
            {posts.length === 0 ? (
              <div data-reveal="" className="sm:col-span-2">
                <EmptyState
                  icon={Newspaper}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </div>
            ) : (filteredPosts.map((post, index) => {
              const isFeatured = index === 0;
              return (
                <article
                  key={post.id}
                  data-reveal=""
                  data-reveal-delay={Math.min(index, 5) * 50}
                >
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group relative flex h-80 flex-col justify-between overflow-hidden rounded-none border border-border bg-muted p-6 transition-colors duration-200 hover:border-primary/50 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-0 transition-[clip-path] duration-300 ease-out ${
                        isFeatured
                          ? "[clip-path:inset(0_0_0%_0)]"
                          : "[clip-path:inset(0_0_100%_0)] group-hover:[clip-path:inset(0_0_0%_0)] group-focus-visible:[clip-path:inset(0_0_0%_0)]"
                      }`}
                    >
                      <img
                        src={post.image}
                        alt={post.title}
                        loading={index < 2 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index === 0 ? "high" : "auto"}
                        className="size-full object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <span
                        className={`text-xs font-medium tracking-wider uppercase transition-colors duration-200 ${
                          isFeatured
                            ? "text-white/85"
                            : "text-muted-foreground group-hover:text-white/85 group-focus-visible:text-white/85"
                        }`}
                      >
                        {categoryLabels[post.category] ?? post.category}
                      </span>
                      <span
                        className={`text-xs transition-colors duration-200 ${
                          isFeatured
                            ? "text-white/80"
                            : "text-muted-foreground group-hover:text-white/80 group-focus-visible:text-white/80"
                        }`}
                      >
                        {post.dateLabel}
                      </span>
                    </div>

                    <h3
                      className={`relative z-10 text-2xl leading-snug font-semibold transition-colors duration-200 ${
                        isFeatured
                          ? "text-white"
                          : "text-foreground group-hover:text-white group-focus-visible:text-white"
                      }`}
                    >
                      {post.title}
                    </h3>
                  </Link>
                </article>
              );
            }))}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Blog11 };
