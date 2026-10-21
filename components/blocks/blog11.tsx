"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";

import { Separator } from "@/components/ui/separator";
import { STUDIO_BLOG_POSTS, type CatalogBlogPost } from "@/lib/studio-catalog";

export interface Blog11Props {
  id?: string;
  heading?: string;
  description?: string;
  posts?: CatalogBlogPost[];
  asPageHeading?: boolean;
}

const Blog11 = ({
  id,
  heading = "Blog",
  description = "Latest news, studio updates, and design stories from Plus In Plus.",
  posts = STUDIO_BLOG_POSTS,
  asPageHeading = false,
}: Blog11Props) => {
  const layoutScope = id || heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(posts.map((post) => post.category)));
    return ["All", ...unique];
  }, [posts]);

  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filteredPosts = useMemo(() => {
    if (activeCategory === "All") return posts;
    return posts.filter((post) => post.category === activeCategory);
  }, [activeCategory, posts]);

  const HeadingTag = asPageHeading ? "h1" : "h2";

  return (
    <section id={id} className="py-32">
      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <HeadingTag className="text-4xl font-semibold tracking-tight md:text-5xl">
                {heading}
              </HeadingTag>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
              <Separator className="my-8" />
              <div className="flex flex-wrap gap-5 lg:flex-col lg:gap-4">
                {categories.map((category) => {
                  const isActive = activeCategory === category;
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
                      {category}
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
            {filteredPosts.map((post, index) => {
              const isFeatured = index === 0;
              return (
                <article key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group relative flex h-80 flex-col justify-between overflow-hidden rounded-xl bg-muted p-6 focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(250,250,250,0.18)]"
                  >
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-0 transition-[clip-path] duration-300 ease-out will-change-[clip-path] ${
                        isFeatured
                          ? "[clip-path:inset(0_0_0%_0)]"
                          : "[clip-path:inset(0_0_100%_0)] group-hover:[clip-path:inset(0_0_0%_0)] group-focus-visible:[clip-path:inset(0_0_0%_0)]"
                      }`}
                    >
                      <img
                        src={post.image}
                        alt={post.title}
                        className="size-full object-cover"
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
                        {post.category}
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
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Blog11 };
