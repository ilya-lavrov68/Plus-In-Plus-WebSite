"use client";

import Link from "next/link";
import { Mail, Send, ShoppingBag } from "lucide-react";

import { DropdownFeatured, type FeaturedPostData } from "@/components/site/dropdown-featured";

export interface DropdownSocnetProps {
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}

function YouTubeIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function VkIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.016-1.12.508-1.597 1.047-1.597.433 0 .742.274 1.258.766.772.735 1.34 1.746 2.457 1.746h3.047c.563 0 .895-.274.742-.82-.187-.665-1.508-2.316-2.078-2.915-.477-.502-.414-.688.117-1.407.992-1.344 2.219-3.047 2.445-4.148.117-.57-.156-.844-.719-.844h-2.984c-.461 0-.711.234-.859.688-.563 1.719-1.531 3.484-2.219 4.297-.477.562-.648.437-.648-.063V8.875c0-.5-.141-.875-.688-.875H10.5c-.328 0-.531.18-.531.391 0 .422.5.547.547 1.781v2.703c0 .594-.273.703-.531.25-.797-1.39-1.586-2.938-2.234-4.516-.188-.453-.438-.609-.922-.609H3.844c-.609 0-.734.281-.734.594 0 .547.703 3.328 3.266 6.969 1.719 2.469 4.125 3.664 6.786 3.664v-.052z"/>
    </svg>
  );
}

const SOCIAL_ITEMS = [
  {
    label: "VK",
    description: "Follow Plus In Plus on VK.",
    href: "https://vk.com/plusinplus",
    icon: VkIcon,
    iconBg: "bg-[#00C56D]",
    external: true,
  },
  {
    label: "Telegram",
    description: "Studio updates, straight to your feed.",
    href: "https://t.me/plusinplus",
    icon: Send,
    iconBg: "bg-[#00C56D]",
    external: true,
  },
  {
    label: "YouTube",
    description: "Watch ideas take shape in the studio.",
    href: "https://www.youtube.com/@plusinplus",
    icon: YouTubeIcon,
    iconBg: "bg-[#00C56D]",
    external: true,
  },
];

const CONTACT_ITEMS = [
  {
    label: "Contact us",
    description: "Get in touch with our team today.",
    href: "/contact",
    icon: Mail,
    iconBg: "bg-[#00C56D]",
  },
  {
    label: "Order",
    description: "Place a request for your next design.",
    href: "/shop",
    icon: ShoppingBag,
    iconBg: "bg-[#00C56D]",
  },
];

export function DropdownSocnet({
  id = "socnet",
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: DropdownSocnetProps) {
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label="SOCNET navigation menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-labelledby="socnet-section-social">
              <h2
                id="socnet-section-social"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Social
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SOCIAL_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]"
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-[#052B42]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
                          {item.description}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="socnet-section-contact">
              <h2
                id="socnet-section-contact"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                Contact
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {CONTACT_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]"
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-[#052B42]" strokeWidth={2} />
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
