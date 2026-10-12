"use client";

import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Code,
  FolderOpen,
  Handshake,
  Layers,
  Newspaper,
} from "lucide-react";

import { DropdownFeatured, type FeaturedPostData } from "@/components/site/dropdown-featured";
import { cn } from "@/lib/utils";

export interface DropdownAboutProps {
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}

const COMPANY_ITEMS = [
  {
    label: "How we work",
    description: "A clear process, from first idea to final design.",
    href: "/#features",
    icon: Briefcase,
    iconBg: "bg-blue-500",
  },
  {
    label: "Our partners",
    description: "Meet the people we build great work with.",
    href: "/#partners",
    icon: Handshake,
    iconBg: "bg-emerald-500",
  },
  {
    label: "Studio news",
    description: "The latest from the Plus In Plus studio.",
    href: "/#news",
    icon: Newspaper,
    iconBg: "bg-purple-500",
  },
  {
    label: "Blog",
    description: "Ideas, inspiration, and design stories.",
    href: "/blog",
    icon: BookOpen,
    iconBg: "bg-orange-500",
  },
];

const RESOURCES_ITEMS = [
  {
    label: "Case studies",
    description: "Deep dives into client work and design systems.",
    href: "/blog",
    icon: FolderOpen,
    iconBg: "bg-amber-500",
  },
  {
    label: "Design systems",
    description: "Scalable UI foundations and brand guidelines.",
    href: "/blog",
    icon: Layers,
    iconBg: "bg-indigo-500",
  },
  {
    label: "Front-end development",
    description: "Engineering design into production code.",
    href: "/blog",
    icon: Code,
    iconBg: "bg-rose-500",
  },
];

export function DropdownAbout({
  id = "about",
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: DropdownAboutProps) {
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label="ABOUT PIP navigation menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-labelledby="about-section-company">
              <h2
                id="about-section-company"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Company
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {COMPANY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm text-white transition-transform duration-200 ease-out group-hover:scale-105",
                          item.iconBg,
                        )}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-white" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="about-section-resources">
              <h2
                id="about-section-resources"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Resources
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {RESOURCES_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm text-white transition-transform duration-200 ease-out group-hover:scale-105",
                          item.iconBg,
                        )}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-white" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <DropdownFeatured featuredPost={featuredPost} onLinkClick={onLinkClick} />
      </div>
    </div>
  );
}
