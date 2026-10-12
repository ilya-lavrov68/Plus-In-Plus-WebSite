"use client";

import Link from "next/link";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Code,
  Flag,
  FolderOpen,
  GraduationCap,
  Handshake,
  Home,
  Image as ImageIcon,
  Layers,
  Mail,
  Megaphone,
  Newspaper,
  Palette,
  RectangleHorizontal,
  Rocket,
  Send,
  ShoppingBag,
  Store,
  Tag,
  Users,
} from "lucide-react";

import { DropdownForPlay } from "@/components/site/dropdown-forplay";
import { DropdownShop } from "@/components/site/dropdown-shop";
import { DropdownAbout } from "@/components/site/dropdown-about";
import { DropdownSocnet } from "@/components/site/dropdown-socnet";
import type { FeaturedPostData } from "@/components/site/dropdown-featured";
import { cn } from "@/lib/utils";

export function YouTubeIcon(props: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export function VkIcon(props: LucideProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.016-1.12.508-1.597 1.047-1.597.433 0 .742.274 1.258.766.772.735 1.34 1.746 2.457 1.746h3.047c.563 0 .895-.274.742-.82-.187-.665-1.508-2.316-2.078-2.915-.477-.502-.414-.688.117-1.407.992-1.344 2.219-3.047 2.445-4.148.117-.57-.156-.844-.719-.844h-2.984c-.461 0-.711.234-.859.688-.563 1.719-1.531 3.484-2.219 4.297-.477.562-.648.437-.648-.063V8.875c0-.5-.141-.875-.688-.875H10.5c-.328 0-.531.18-.531.391 0 .422.5.547.547 1.781v2.703c0 .594-.273.703-.531.25-.797-1.39-1.586-2.938-2.234-4.516-.188-.453-.438-.609-.922-.609H3.844c-.609 0-.734.281-.734.594 0 .547.703 3.328 3.266 6.969 1.719 2.469 4.125 3.664 6.786 3.664v-.052z"/>
    </svg>
  );
}

export type NavigationIcon = LucideIcon | typeof YouTubeIcon | typeof VkIcon;

export interface NavigationMenuLink {
  label: string;
  description: string;
  href: string;
  icon: NavigationIcon;
  iconBg?: string;
  external?: boolean;
}

export interface NavigationSubSection {
  title: string;
  items: NavigationMenuLink[];
}

export interface NavigationSection {
  id: string;
  title: string;
  subsections?: NavigationSubSection[];
  items: NavigationMenuLink[];
}

export interface NavigationItem {
  id: string;
  label: string;
  sectionId: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: "for-play", label: "FOR PLAY", sectionId: "for-play" },
  { id: "shop", label: "SHOP", sectionId: "shop" },
  { id: "about-pip", label: "ABOUT PIP", sectionId: "about-pip" },
  { id: "socnet", label: "SOCNET", sectionId: "socnet" },
];

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "for-play",
    title: "FOR PLAY",
    subsections: [
      {
        title: "Services",
        items: [
          { label: "Order a design", description: "Get a professional design for your brand.", href: "/shop", icon: ShoppingBag, iconBg: "bg-emerald-500" },
          { label: "Design services", description: "Thoughtful visuals for every kind of project.", href: "/shop", icon: Palette, iconBg: "bg-blue-500" },
          { label: "Small designs", description: "Clear, eye-catching details for your brand.", href: "/shop#small-designs", icon: Tag, iconBg: "bg-purple-500" },
          { label: "Large designs", description: "Big-format ideas built to be noticed.", href: "/shop#large-designs", icon: Building, iconBg: "bg-orange-500" },
        ],
      },
      {
        title: "Programs",
        items: [
          { label: "Nebius Fellows", description: "Supporting exceptional researchers and engineers.", href: "/#programs", icon: Users, iconBg: "bg-indigo-500" },
          { label: "Startup program", description: "Design acceleration for high-growth tech startups.", href: "/#programs", icon: Rocket, iconBg: "bg-rose-500" },
          { label: "Research grants", description: "Fueling scientific discovery and academic work.", href: "/#programs", icon: GraduationCap, iconBg: "bg-amber-500" },
        ],
      },
    ],
    items: [
      { label: "Order a design", description: "Get a professional design for your brand.", href: "/shop", icon: ShoppingBag, iconBg: "bg-emerald-500" },
      { label: "Design services", description: "Thoughtful visuals for every kind of project.", href: "/shop", icon: Palette, iconBg: "bg-blue-500" },
      { label: "Small designs", description: "Clear, eye-catching details for your brand.", href: "/shop#small-designs", icon: Tag, iconBg: "bg-purple-500" },
      { label: "Large designs", description: "Big-format ideas built to be noticed.", href: "/shop#large-designs", icon: Building, iconBg: "bg-orange-500" },
      { label: "Nebius Fellows", description: "Supporting exceptional researchers and engineers.", href: "/#programs", icon: Users, iconBg: "bg-indigo-500" },
      { label: "Startup program", description: "Design acceleration for high-growth tech startups.", href: "/#programs", icon: Rocket, iconBg: "bg-rose-500" },
      { label: "Research grants", description: "Fueling scientific discovery and academic work.", href: "/#programs", icon: GraduationCap, iconBg: "bg-amber-500" },
    ],
  },
  {
    id: "shop",
    title: "SHOP",
    subsections: [
      {
        title: "Small designs",
        items: [
          { label: "Sign Design", description: "Signage that makes your space stand out.", href: "/shop#small-designs", icon: Store, iconBg: "bg-emerald-500" },
          { label: "Bag Design", description: "Branded bags with a memorable look.", href: "/shop#small-designs", icon: ShoppingBag, iconBg: "bg-blue-500" },
          { label: "Outdoor glass poster", description: "A crisp message for glass and storefronts.", href: "/shop#small-designs", icon: ImageIcon, iconBg: "bg-purple-500" },
          { label: "Banner Design", description: "Flexible visuals for campaigns and events.", href: "/shop#small-designs", icon: Flag, iconBg: "bg-amber-500" },
        ],
      },
      {
        title: "Large designs",
        items: [
          { label: "Large Billboard on a building", description: "Make a bold impression at city scale.", href: "/shop#large-designs", icon: Building2, iconBg: "bg-orange-500" },
          { label: "Rooftop advertising", description: "Bring your message above the skyline.", href: "/shop#large-designs", icon: Home, iconBg: "bg-rose-500" },
          { label: "Advertisement on the fence", description: "High-visibility street-level perimeter branding.", href: "/shop#large-designs", icon: RectangleHorizontal, iconBg: "bg-indigo-500" },
          { label: "Billboard", description: "Unmissable outdoor branding on arterial roads.", href: "/shop#large-designs", icon: Megaphone, iconBg: "bg-emerald-500" },
        ],
      },
    ],
    items: [
      { label: "Sign Design", description: "Signage that makes your space stand out.", href: "/shop#small-designs", icon: Store, iconBg: "bg-emerald-500" },
      { label: "Bag Design", description: "Branded bags with a memorable look.", href: "/shop#small-designs", icon: ShoppingBag, iconBg: "bg-blue-500" },
      { label: "Outdoor glass poster", description: "A crisp message for glass and storefronts.", href: "/shop#small-designs", icon: ImageIcon, iconBg: "bg-purple-500" },
      { label: "Banner Design", description: "Flexible visuals for campaigns and events.", href: "/shop#small-designs", icon: Flag, iconBg: "bg-amber-500" },
      { label: "Large Billboard on a building", description: "Make a bold impression at city scale.", href: "/shop#large-designs", icon: Building2, iconBg: "bg-orange-500" },
      { label: "Rooftop advertising", description: "Bring your message above the skyline.", href: "/shop#large-designs", icon: Home, iconBg: "bg-rose-500" },
      { label: "Advertisement on the fence", description: "High-visibility street-level perimeter branding.", href: "/shop#large-designs", icon: RectangleHorizontal, iconBg: "bg-indigo-500" },
      { label: "Billboard", description: "Unmissable outdoor branding on arterial roads.", href: "/shop#large-designs", icon: Megaphone, iconBg: "bg-emerald-500" },
    ],
  },
  {
    id: "about-pip",
    title: "ABOUT PIP",
    subsections: [
      {
        title: "Company",
        items: [
          { label: "How we work", description: "A clear process, from first idea to final design.", href: "/#features", icon: Briefcase, iconBg: "bg-blue-500" },
          { label: "Our partners", description: "Meet the people we build great work with.", href: "/#partners", icon: Handshake, iconBg: "bg-emerald-500" },
          { label: "Studio news", description: "The latest from the Plus In Plus studio.", href: "/#news", icon: Newspaper, iconBg: "bg-purple-500" },
          { label: "Blog", description: "Ideas, inspiration, and design stories.", href: "/blog", icon: BookOpen, iconBg: "bg-orange-500" },
        ],
      },
      {
        title: "Resources",
        items: [
          { label: "Case studies", description: "Deep dives into client work and design systems.", href: "/blog", icon: FolderOpen, iconBg: "bg-amber-500" },
          { label: "Design systems", description: "Scalable UI foundations and brand guidelines.", href: "/blog", icon: Layers, iconBg: "bg-indigo-500" },
          { label: "Front-end development", description: "Engineering design into production code.", href: "/blog", icon: Code, iconBg: "bg-rose-500" },
        ],
      },
    ],
    items: [
      { label: "How we work", description: "A clear process, from first idea to final design.", href: "/#features", icon: Briefcase, iconBg: "bg-blue-500" },
      { label: "Our partners", description: "Meet the people we build great work with.", href: "/#partners", icon: Handshake, iconBg: "bg-emerald-500" },
      { label: "Studio news", description: "The latest from the Plus In Plus studio.", href: "/#news", icon: Newspaper, iconBg: "bg-purple-500" },
      { label: "Blog", description: "Ideas, inspiration, and design stories.", href: "/blog", icon: BookOpen, iconBg: "bg-orange-500" },
      { label: "Case studies", description: "Deep dives into client work and design systems.", href: "/blog", icon: FolderOpen, iconBg: "bg-amber-500" },
      { label: "Design systems", description: "Scalable UI foundations and brand guidelines.", href: "/blog", icon: Layers, iconBg: "bg-indigo-500" },
      { label: "Front-end development", description: "Engineering design into production code.", href: "/blog", icon: Code, iconBg: "bg-rose-500" },
    ],
  },
  {
    id: "socnet",
    title: "SOCNET",
    subsections: [
      {
        title: "Social",
        items: [
          { label: "VK", description: "Follow Plus In Plus on VK.", href: "https://vk.com/plusinplus", icon: VkIcon, iconBg: "bg-blue-600", external: true },
          { label: "Telegram", description: "Studio updates, straight to your feed.", href: "https://t.me/plusinplus", icon: Send, iconBg: "bg-sky-500", external: true },
          { label: "YouTube", description: "Watch ideas take shape in the studio.", href: "https://www.youtube.com/@plusinplus", icon: YouTubeIcon, iconBg: "bg-red-500", external: true },
        ],
      },
      {
        title: "Contact",
        items: [
          { label: "Contact us", description: "Get in touch with our team today.", href: "/contact", icon: Mail, iconBg: "bg-emerald-500" },
          { label: "Order", description: "Place a request for your next design.", href: "/shop", icon: ShoppingBag, iconBg: "bg-purple-500" },
        ],
      },
    ],
    items: [
      { label: "VK", description: "Follow Plus In Plus on VK.", href: "https://vk.com/plusinplus", icon: VkIcon, iconBg: "bg-blue-600", external: true },
      { label: "Telegram", description: "Studio updates, straight to your feed.", href: "https://t.me/plusinplus", icon: Send, iconBg: "bg-sky-500", external: true },
      { label: "YouTube", description: "Watch ideas take shape in the studio.", href: "https://www.youtube.com/@plusinplus", icon: YouTubeIcon, iconBg: "bg-red-500", external: true },
      { label: "Contact us", description: "Get in touch with our team today.", href: "/contact", icon: Mail, iconBg: "bg-emerald-500" },
      { label: "Order", description: "Place a request for your next design.", href: "/shop", icon: ShoppingBag, iconBg: "bg-purple-500" },
    ],
  },
];

export function getNavigationSection(sectionId: string) {
  const normalized = sectionId === "services" ? "for-play" : sectionId === "catalog" ? "shop" : sectionId === "company" ? "about-pip" : sectionId === "social" ? "socnet" : sectionId;
  return NAVIGATION_SECTIONS.find((section) => section.id === normalized || section.id === sectionId);
}

export function NavigationMenuEntry({
  item,
  compact = false,
  onSelect,
}: {
  item: NavigationMenuLink;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const Icon = item.icon;
  const className = compact
    ? "group flex min-w-0 items-start gap-3 rounded-xl p-2.5 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
    : "group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

  const iconBg = item.iconBg || "bg-emerald-500";
  const iconClassName = cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm text-white transition-transform duration-200 ease-out group-hover:scale-105",
    iconBg,
  );

  const content = (
    <>
      <span className={iconClassName}>
        <Icon aria-hidden="true" className="h-4 w-4 text-white" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">{item.label}</span>
        {item.description ? (
          <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
            {item.description}
          </span>
        ) : null}
      </span>
    </>
  );

  return item.external ? (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onSelect}
      className={className}
    >
      {content}
    </a>
  ) : (
    <Link href={item.href} onClick={onSelect} className={className}>
      {content}
    </Link>
  );
}

export function NavDropdown({
  id,
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: {
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}) {
  if (id === "forplay" || id === "for-play") {
    return (
      <DropdownForPlay
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onLinkClick={onLinkClick}
        featuredPost={featuredPost}
      />
    );
  }
  if (id === "shop") {
    return (
      <DropdownShop
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onLinkClick={onLinkClick}
        featuredPost={featuredPost}
      />
    );
  }
  if (id === "about" || id === "about-pip") {
    return (
      <DropdownAbout
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onLinkClick={onLinkClick}
        featuredPost={featuredPost}
      />
    );
  }
  if (id === "socnet") {
    return (
      <DropdownSocnet
        id={id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onLinkClick={onLinkClick}
        featuredPost={featuredPost}
      />
    );
  }
  return null;
}
