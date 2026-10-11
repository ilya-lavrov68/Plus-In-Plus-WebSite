import Image from "next/image";
import Link from "next/link";
import type { LucideProps } from "lucide-react";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Circle,
  Flag,
  Handshake,
  Home,
  Image as ImageIcon,
  Newspaper,
  Palette,
  Send,
  ShoppingBag,
  Store,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function YouTubeIcon(props: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type NavigationIcon = LucideIcon | typeof YouTubeIcon;

export interface NavigationMenuLink {
  label: string;
  description: string;
  href: string;
  icon: NavigationIcon;
  external?: boolean;
}

export interface NavigationSection {
  id: string;
  title: string;
  items: NavigationMenuLink[];
}

export interface NavigationItem {
  id: string;
  label: string;
  sectionId: string;
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "services",
    title: "Services",
    items: [
      {
        label: "Order a design",
        description: "Get a professional design for your brand.",
        href: "/shop",
        icon: ShoppingBag,
      },
      {
        label: "Design services",
        description: "Thoughtful visuals for every kind of project.",
        href: "/shop",
        icon: Palette,
      },
      {
        label: "Small designs",
        description: "Clear, eye-catching details for your brand.",
        href: "/shop#small-designs",
        icon: Tag,
      },
      {
        label: "Large designs",
        description: "Big-format ideas built to be noticed.",
        href: "/shop#large-designs",
        icon: Building,
      },
    ],
  },
  {
    id: "catalog",
    title: "Catalog",
    items: [
      {
        label: "Sign Design",
        description: "Signage that makes your space stand out.",
        href: "/shop#small-designs",
        icon: Store,
      },
      {
        label: "Bag Design",
        description: "Branded bags with a memorable look.",
        href: "/shop#small-designs",
        icon: ShoppingBag,
      },
      {
        label: "Outdoor glass poster",
        description: "A crisp message for glass and storefronts.",
        href: "/shop#small-designs",
        icon: ImageIcon,
      },
      {
        label: "Banner Design",
        description: "Flexible visuals for campaigns and events.",
        href: "/shop#small-designs",
        icon: Flag,
      },
      {
        label: "Large Billboard",
        description: "Make a bold impression at city scale.",
        href: "/shop#large-designs",
        icon: Building2,
      },
      {
        label: "Rooftop advertising",
        description: "Bring your message above the skyline.",
        href: "/shop#large-designs",
        icon: Home,
      },
    ],
  },
  {
    id: "company",
    title: "Company",
    items: [
      {
        label: "How we work",
        description: "A clear process, from first idea to final design.",
        href: "/#features",
        icon: Briefcase,
      },
      {
        label: "Our partners",
        description: "Meet the people we build great work with.",
        href: "/#partners",
        icon: Handshake,
      },
      {
        label: "Studio news",
        description: "The latest from the Plus In Plus studio.",
        href: "/#news",
        icon: Newspaper,
      },
      {
        label: "Blog",
        description: "Ideas, inspiration, and design stories.",
        href: "/blog",
        icon: BookOpen,
      },
    ],
  },
  {
    id: "social",
    title: "Social",
    items: [
      {
        label: "VK",
        description: "Follow Plus In Plus on VK.",
        href: "https://vk.com/plusinplus",
        icon: Circle,
        external: true,
      },
      {
        label: "Telegram",
        description: "Studio updates, straight to your feed.",
        href: "https://t.me/plusinplus",
        icon: Send,
        external: true,
      },
      {
        label: "YouTube",
        description: "Watch ideas take shape in the studio.",
        href: "https://www.youtube.com/@plusinplus",
        icon: YouTubeIcon,
        external: true,
      },
    ],
  },
];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: "for-play", label: "FOR PLAY", sectionId: "services" },
  { id: "shop", label: "SHOP", sectionId: "catalog" },
  { id: "about-pip", label: "ABOUT PIP", sectionId: "company" },
  { id: "socnet", label: "SOCNET", sectionId: "social" },
];

export function getNavigationSection(sectionId: string) {
  return NAVIGATION_SECTIONS.find((section) => section.id === sectionId);
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
  const iconClassName = compact
    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-navy transition-colors duration-200 ease-out group-hover:bg-green-200"
    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-navy transition-colors duration-200 ease-out group-hover:bg-green-200";

  const content = (
    <>
      <span className={iconClassName}>
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-navy">{item.label}</span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
          {item.description}
        </span>
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
}: {
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLinkClick?: () => void;
}) {
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label="Plus In Plus navigation menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            {NAVIGATION_SECTIONS.map((section) => (
              <section key={section.id} aria-labelledby={`navigation-section-${section.id}`}>
                <h2
                  id={`navigation-section-${section.id}`}
                  className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
                >
                  {section.title}
                </h2>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <NavigationMenuEntry
                      key={item.label}
                      item={item}
                      onSelect={onLinkClick}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-gray-100 bg-[#FAFCFB] p-5 md:block lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            Featured
          </p>
          <Link
            href="/blog"
            onClick={onLinkClick}
            className="group mt-3 block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-[#DCE8FF]">
              <Image
                src="/assets/gradients/hero-gradient.svg"
                alt=""
                fill
                sizes="(min-width: 1280px) 320px, (min-width: 1024px) 272px, 208px"
                className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 flex items-end justify-between bg-[#052B42]/10 p-3">
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy">
                  Studio journal
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C56D] text-navy">
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
            </div>
            <h3 className="mt-3 font-geist text-base font-semibold leading-snug text-navy transition-colors duration-200 ease-out group-hover:text-[#397248]">
              Inside the Plus In Plus studio
            </h3>
            <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-gray-500">
              A closer look at the ideas, process, and people behind the work.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
              Explore the blog
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
