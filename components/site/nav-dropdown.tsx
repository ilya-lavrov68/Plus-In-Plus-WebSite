"use client";

import Link from "next/link";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Flag,
  FolderOpen,
  Handshake,
  Home,
  Image as ImageIcon,
  Layers,
  Mail,
  Megaphone,
  Newspaper,
  Palette,
  RectangleHorizontal,
  Send,
  ShoppingBag,
  Store,
  Tag,
} from "lucide-react";
import { useTranslations } from "next-intl";

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

/**
 * A navigation entry. Copy lives in `messages/*.json` under `nav.items.<key>`.
 * Brand names stay literal on purpose: VK, Telegram and YouTube are never
 * translated, so they carry a `label` instead of a `key`.
 */
export interface NavigationMenuLink {
  /** Key inside the `nav.items` namespace, e.g. `orderDesign`. */
  key?: string;
  /** Literal label for brand names and social networks. */
  label?: string;
  href: string;
  icon: NavigationIcon;
  iconBg?: string;
  external?: boolean;
}

export interface NavigationSubSection {
  /** Key inside the `nav.sections` namespace. */
  titleKey: string;
  items: NavigationMenuLink[];
}

export interface NavigationSection {
  id: string;
  /** Key inside the `nav.sections` namespace. */
  titleKey: string;
  subsections?: NavigationSubSection[];
  items: NavigationMenuLink[];
}

export interface NavigationItem {
  id: string;
  /** Key inside the `header` namespace (the four mega-menu triggers). */
  labelKey: string;
  sectionId: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: "for-play", labelKey: "forPlay", sectionId: "for-play" },
  { id: "shop", labelKey: "shop", sectionId: "shop" },
  { id: "about-pip", labelKey: "about", sectionId: "about-pip" },
  { id: "socnet", labelKey: "socnet", sectionId: "socnet" },
];

const GREEN = "bg-[#00C56D]";

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "for-play",
    titleKey: "services",
    subsections: [
      {
        titleKey: "services",
        items: [
          { key: "orderDesign", href: "/shop", icon: ShoppingBag, iconBg: GREEN },
          { key: "designServices", href: "/shop", icon: Palette, iconBg: GREEN },
          { key: "smallDesigns", href: "/shop#small-designs", icon: Tag, iconBg: GREEN },
          { key: "largeDesigns", href: "/shop#large-designs", icon: Building, iconBg: GREEN },
        ],
      },
    ],
    items: [
      { key: "orderDesign", href: "/shop", icon: ShoppingBag, iconBg: GREEN },
      { key: "designServices", href: "/shop", icon: Palette, iconBg: GREEN },
      { key: "smallDesigns", href: "/shop#small-designs", icon: Tag, iconBg: GREEN },
      { key: "largeDesigns", href: "/shop#large-designs", icon: Building, iconBg: GREEN },
    ],
  },
  {
    id: "shop",
    titleKey: "smallDesigns",
    subsections: [
      {
        titleKey: "smallDesigns",
        items: [
          { key: "signDesign", href: "/shop#small-designs", icon: Store, iconBg: GREEN },
          { key: "bagDesign", href: "/shop#small-designs", icon: ShoppingBag, iconBg: GREEN },
          { key: "outdoorGlassPoster", href: "/shop#small-designs", icon: ImageIcon, iconBg: GREEN },
          { key: "bannerDesign", href: "/shop#small-designs", icon: Flag, iconBg: GREEN },
        ],
      },
      {
        titleKey: "largeDesigns",
        items: [
          { key: "largeBillboard", href: "/shop#large-designs", icon: Building2, iconBg: GREEN },
          { key: "rooftopAdvertising", href: "/shop#large-designs", icon: Home, iconBg: GREEN },
          { key: "advertisementOnTheFence", href: "/shop#large-designs", icon: RectangleHorizontal, iconBg: GREEN },
          { key: "billboard", href: "/shop#large-designs", icon: Megaphone, iconBg: GREEN },
        ],
      },
    ],
    items: [
      { key: "signDesign", href: "/shop#small-designs", icon: Store, iconBg: GREEN },
      { key: "bagDesign", href: "/shop#small-designs", icon: ShoppingBag, iconBg: GREEN },
      { key: "outdoorGlassPoster", href: "/shop#small-designs", icon: ImageIcon, iconBg: GREEN },
      { key: "bannerDesign", href: "/shop#small-designs", icon: Flag, iconBg: GREEN },
      { key: "largeBillboard", href: "/shop#large-designs", icon: Building2, iconBg: GREEN },
      { key: "rooftopAdvertising", href: "/shop#large-designs", icon: Home, iconBg: GREEN },
      { key: "advertisementOnTheFence", href: "/shop#large-designs", icon: RectangleHorizontal, iconBg: GREEN },
      { key: "billboard", href: "/shop#large-designs", icon: Megaphone, iconBg: GREEN },
    ],
  },
  {
    id: "about-pip",
    titleKey: "company",
    subsections: [
      {
        titleKey: "company",
        items: [
          { key: "howWeWork", href: "/#features", icon: Briefcase, iconBg: GREEN },
          { key: "ourPartners", href: "/#partners", icon: Handshake, iconBg: GREEN },
          { key: "studioNews", href: "/#news", icon: Newspaper, iconBg: GREEN },
          { key: "blog", href: "/blog", icon: BookOpen, iconBg: GREEN },
        ],
      },
      {
        titleKey: "resources",
        items: [
          { key: "caseStudies", href: "/blog", icon: FolderOpen, iconBg: GREEN },
          { label: "Design systems", href: "/blog", icon: Layers, iconBg: GREEN },
        ],
      },
    ],
    items: [
      { key: "howWeWork", href: "/#features", icon: Briefcase, iconBg: GREEN },
      { key: "ourPartners", href: "/#partners", icon: Handshake, iconBg: GREEN },
      { key: "studioNews", href: "/#news", icon: Newspaper, iconBg: GREEN },
      { key: "blog", href: "/blog", icon: BookOpen, iconBg: GREEN },
      { key: "caseStudies", href: "/blog", icon: FolderOpen, iconBg: GREEN },
      { label: "Design systems", href: "/blog", icon: Layers, iconBg: GREEN },
    ],
  },
  {
    id: "socnet",
    titleKey: "social",
    subsections: [
      {
        titleKey: "social",
        items: [
          { key: "vk", label: "VK", href: "https://vk.com/plusinplus", icon: VkIcon, iconBg: GREEN, external: true },
          { key: "telegram", label: "Telegram", href: "https://t.me/plusinplus", icon: Send, iconBg: GREEN, external: true },
          { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@plusinplus", icon: YouTubeIcon, iconBg: GREEN, external: true },
        ],
      },
      {
        titleKey: "contact",
        items: [
          { key: "contactUs", href: "/contact", icon: Mail, iconBg: GREEN },
          { key: "order", href: "/shop", icon: ShoppingBag, iconBg: GREEN },
        ],
      },
    ],
    items: [
      { key: "vk", label: "VK", href: "https://vk.com/plusinplus", icon: VkIcon, iconBg: GREEN, external: true },
      { key: "telegram", label: "Telegram", href: "https://t.me/plusinplus", icon: Send, iconBg: GREEN, external: true },
      { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@plusinplus", icon: YouTubeIcon, iconBg: GREEN, external: true },
      { key: "contactUs", href: "/contact", icon: Mail, iconBg: GREEN },
      { key: "order", href: "/shop", icon: ShoppingBag, iconBg: GREEN },
    ],
  },
];

/**
 * Locale-aware label of a navigation entry. Exception terms (brand names such as
 * VK, Telegram, YouTube and technical names such as "Design systems") carry a
 * literal `label` and are never looked up as a message.
 */
export function navigationLabel(
  t: (key: string) => string,
  item: { key?: string; label?: string },
): string {
  if (item.label) return item.label;
  return item.key ? t(`items.${item.key}.label`) : "";
}

export function navigationDescription(
  t: (key: string) => string,
  item: { key?: string },
): string {
  return item.key ? t(`items.${item.key}.description`) : "";
}

export function getNavigationSection(id: string): NavigationSection | undefined {
  return NAVIGATION_SECTIONS.find((section) => section.id === id);
}

/**
 * One entry of the enlarged mobile menu: icon, label, description
 * (and an external-link marker for social networks).
 */
export function NavigationMenuEntry({
  item,
  onSelect,
}: {
  item: NavigationMenuLink;
  onSelect?: () => void;
}) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  const label = navigationLabel(t, item);
  const description = navigationDescription(t, item);
  const className =
    "group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#052B42]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">{description}</span>
        ) : null}
      </span>
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSelect}
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onSelect} className={className}>
      {body}
    </Link>
  );
}
