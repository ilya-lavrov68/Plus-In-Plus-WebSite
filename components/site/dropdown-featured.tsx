"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export interface FeaturedPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string | null;
  isFeatured?: boolean;
}

export function DropdownFeatured({
  featuredPost,
  onLinkClick,
}: {
  featuredPost?: FeaturedPostData | null;
  onLinkClick?: () => void;
}) {
  const post = featuredPost || {
    id: "default",
    title: "Inside the Plus In Plus studio",
    slug: "",
    excerpt: "A closer look at the ideas, process, and people behind the work.",
    coverImage: "/assets/gradients/hero-gradient.svg",
    isFeatured: false,
  };

  const href = post.slug ? `/blog/${post.slug}` : "/blog";
  const imageSrc = post.coverImage || "/assets/gradients/hero-gradient.svg";

  return (
    <aside className="hidden min-h-0 overflow-y-auto border-l border-gray-100 bg-[#FAFCFB] p-5 md:block lg:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
        Featured
      </p>
      <Link
        href={href}
        onClick={onLinkClick}
        className="group mt-3 block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#DCE8FF]">
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 1024px) 272px, 208px"
            className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 flex items-end justify-between bg-[#052B42]/10 p-3">
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy">
              {post.isFeatured ? "Featured" : "Studio journal"}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform duration-200 ease-out group-hover:scale-110">
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </div>
        </div>
        <h3 className="mt-3 font-geist text-base font-semibold leading-snug text-navy transition-colors duration-200 ease-out group-hover:text-[#397248]">
          {post.title}
        </h3>
        <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-gray-500">
          {post.excerpt}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy group-hover:underline">
          Explore the blog
          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </Link>
    </aside>
  );
}
