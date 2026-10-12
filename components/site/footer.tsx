import Link from "next/link";

import { FooterSubscribeForm } from "@/components/site/footer-subscribe-form";

export interface FooterLink {
  label: string;
  /** "#" marks a placeholder: the page is not built yet, replace it with the real route. */
  href: string;
}

export interface FooterColumn {
  title: string;
  links: readonly FooterLink[];
}

/**
 * Footer link map. Service entries point at the existing `/shop` sections,
 * studio entries at the landing anchors that are already on the home page, and
 * everything that has no page yet is marked with the "#" placeholder.
 */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Services",
    links: [
      { label: "Website design", href: "/shop#small-designs" },
      { label: "Badge design", href: "/shop#small-designs" },
      { label: "Poster design", href: "/shop#small-designs" },
      { label: "Banner mockup design", href: "/shop#small-designs" },
      { label: "Sign Design", href: "/shop#small-designs" },
      { label: "Bag Design", href: "/shop#small-designs" },
      { label: "Large Billboard", href: "/shop#large-designs" },
      { label: "Rooftop advertising", href: "/shop#large-designs" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "How we work", href: "/#features" },
      { label: "Our partners", href: "/#partners" },
      { label: "TS Connect", href: "/#partners" },
      { label: "Studio news", href: "/#news" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Design systems", href: "#" },
      { label: "Ozone project", href: "#" },
      { label: "Plus For Play", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "User Agreement", href: "#" },
      { label: "Offer", href: "#" },
      { label: "Terms of use", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Account", href: "/?auth=login" },
      { label: "Collaboration", href: "/contact" },
      { label: "Partners", href: "/#partners" },
      { label: "Contact us", href: "/contact" },
    ],
  },
];

export const FOOTER_LEGAL_LINKS: readonly FooterLink[] = [
  { label: "TSConnect Group", href: "/#partners" },
  { label: "Legal documents", href: "#" },
  { label: "Terms of use", href: "#" },
  { label: "Privacy policy", href: "#" },
  { label: "Cookie policy", href: "#" },
];

export const FOOTER_COPYRIGHT = "© 2026 Plus In Plus. All rights reserved.";

export const FOOTER_CTA_HEADING = "Start your journey with Plus In Plus";

const CTA_BUTTON_CLASS =
  "inline-flex h-12 w-full max-w-sm items-center justify-center rounded-xl px-8 font-body text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-[#D6E4FF] lg:w-auto lg:max-w-none";

const FOOTER_LINK_CLASS =
  "rounded-sm font-body text-sm text-navy/70 transition-colors duration-200 ease-out hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

/**
 * Footer: CTA on top, then the newsletter form next to five link columns,
 * the legal row with the copyright, and the oversized decorative wordmark
 * as a watermark on the light-blue brand background.
 */
export function Footer() {
  return (
    <footer className="mt-auto overflow-hidden border-t border-navy/20 bg-[#D6E4FF] text-navy">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 xl:px-12">
        <section aria-labelledby="footer-cta-heading" className="py-16 text-center sm:py-20">
          <h2
            id="footer-cta-heading"
            className="mx-auto max-w-[760px] text-balance font-geist text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl"
          >
            {FOOTER_CTA_HEADING}
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 lg:mt-10 lg:flex-row lg:gap-4">
            <Link href="/shop" className={`${CTA_BUTTON_CLASS} bg-navy text-white hover:bg-[#0A4366]`}>
              Order a design
            </Link>
            <Link
              href="/contact"
              className={`${CTA_BUTTON_CLASS} border border-navy bg-transparent text-navy hover:bg-navy/[0.06]`}
            >
              Talk to us
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-y-12 border-t border-navy/20 pt-12 lg:pt-16 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:gap-x-12">
          <FooterSubscribeForm />

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:gap-x-6"
          >
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="mb-4 font-body text-sm font-semibold text-navy">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={FOOTER_LINK_CLASS}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-navy/20 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="rounded-sm font-body text-xs text-navy/60 transition-colors duration-200 ease-out hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="font-body text-xs text-navy/60">{FOOTER_COPYRIGHT}</p>
        </div>

        {/* Decorative brand watermark: not a link, hidden from assistive tech.
            "Plus in Plus" measures 5.07em in Geist Bold after tracking-tighter
            (verified against the bundled font), so 16.5vw still fills the row
            inside the 5/8/12 container padding without ever clipping, and the
            16rem cap holds it once the 1440px container stops growing. */}
        <div aria-hidden="true" className="mt-12 select-none sm:mt-16">
          <p className="whitespace-nowrap text-center font-geist text-[clamp(3rem,16.5vw,16rem)] font-bold leading-none tracking-tighter text-navy/10">
            Plus in Plus
          </p>
        </div>
      </div>
    </footer>
  );
}
