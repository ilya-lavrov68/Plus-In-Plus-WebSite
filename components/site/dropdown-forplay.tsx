"use client";

import Link from "next/link";
import {
  Building,
  GraduationCap,
  Palette,
  Rocket,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";

import { DropdownFeatured, type FeaturedPostData } from "@/components/site/dropdown-featured";
import { cn } from "@/lib/utils";

export interface DropdownForPlayProps {
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}

const SERVICES_ITEMS = [
  {
    label: "Order a design",
    description: "Get a professional design for your brand.",
    href: "/shop",
    icon: ShoppingBag,
    iconBg: "bg-emerald-500",
  },
  {
    label: "Design services",
    description: "Thoughtful visuals for every kind of project.",
    href: "/shop",
    icon: Palette,
    iconBg: "bg-blue-500",
  },
  {
    label: "Small designs",
    description: "Clear, eye-catching details for your brand.",
    href: "/shop#small-designs",
    icon: Tag,
    iconBg: "bg-purple-500",
  },
  {
    label: "Large designs",
    description: "Big-format ideas built to be noticed.",
    href: "/shop#large-designs",
    icon: Building,
    iconBg: "bg-orange-500",
  },
];

const PROGRAMS_ITEMS = [
  {
    label: "Nebius Fellows",
    description: "Supporting exceptional researchers and engineers.",
    href: "/#programs",
    icon: Users,
    iconBg: "bg-indigo-500",
  },
  {
    label: "Startup program",
    description: "Design acceleration for high-growth tech startups.",
    href: "/#programs",
    icon: Rocket,
    iconBg: "bg-rose-500",
  },
  {
    label: "Research grants",
    description: "Fueling scientific discovery and academic work.",
    href: "/#programs",
    icon: GraduationCap,
    iconBg: "bg-amber-500",
  },
];

export function DropdownForPlay({
  id = "forplay",
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: DropdownForPlayProps) {
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label="FOR PLAY navigation menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-labelledby="forplay-section-services">
              <h2
                id="forplay-section-services"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Services
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SERVICES_ITEMS.map((item) => {
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

            <section aria-labelledby="forplay-section-programs">
              <h2
                id="forplay-section-programs"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Programs
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {PROGRAMS_ITEMS.map((item) => {
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
