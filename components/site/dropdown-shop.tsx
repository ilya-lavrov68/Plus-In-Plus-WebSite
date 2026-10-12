"use client";

import Link from "next/link";
import {
  Building2,
  Flag,
  Home,
  Image as ImageIcon,
  Megaphone,
  RectangleHorizontal,
  ShoppingBag,
  Store,
} from "lucide-react";

import { DropdownFeatured, type FeaturedPostData } from "@/components/site/dropdown-featured";
import { cn } from "@/lib/utils";

export interface DropdownShopProps {
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}

const SMALL_DESIGNS_ITEMS = [
  {
    label: "Sign Design",
    description: "Signage that makes your space stand out.",
    href: "/shop#small-designs",
    icon: Store,
    iconBg: "bg-emerald-500",
  },
  {
    label: "Bag Design",
    description: "Branded bags with a memorable look.",
    href: "/shop#small-designs",
    icon: ShoppingBag,
    iconBg: "bg-blue-500",
  },
  {
    label: "Outdoor glass poster",
    description: "A crisp message for glass and storefronts.",
    href: "/shop#small-designs",
    icon: ImageIcon,
    iconBg: "bg-purple-500",
  },
  {
    label: "Banner Design",
    description: "Flexible visuals for campaigns and events.",
    href: "/shop#small-designs",
    icon: Flag,
    iconBg: "bg-amber-500",
  },
];

const LARGE_DESIGNS_ITEMS = [
  {
    label: "Large Billboard on a building",
    description: "Make a bold impression at city scale.",
    href: "/shop#large-designs",
    icon: Building2,
    iconBg: "bg-orange-500",
  },
  {
    label: "Rooftop advertising",
    description: "Bring your message above the skyline.",
    href: "/shop#large-designs",
    icon: Home,
    iconBg: "bg-rose-500",
  },
  {
    label: "Advertisement on the fence",
    description: "High-visibility street-level perimeter branding.",
    href: "/shop#large-designs",
    icon: RectangleHorizontal,
    iconBg: "bg-indigo-500",
  },
  {
    label: "Billboard",
    description: "Unmissable outdoor branding on arterial roads.",
    href: "/shop#large-designs",
    icon: Megaphone,
    iconBg: "bg-emerald-500",
  },
];

export function DropdownShop({
  id = "shop",
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: DropdownShopProps) {
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label="SHOP navigation menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-labelledby="shop-section-small">
              <h2
                id="shop-section-small"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Small designs
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SMALL_DESIGNS_ITEMS.map((item) => {
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

            <section aria-labelledby="shop-section-large">
              <h2
                id="shop-section-large"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Large designs
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {LARGE_DESIGNS_ITEMS.map((item) => {
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
