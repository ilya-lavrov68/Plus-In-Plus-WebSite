import Link from "next/link";

export interface FooterGroup {
  title: string;
  links: { label: string; href: string }[];
}

export interface SiteFooterProps {
  description: string;
  groups: FooterGroup[];
  social: { label: string; href: string }[];
  contactEmail?: string;
  contactPhone?: string;
  legal: { label: string; href: string }[];
  locale: "ru" | "en";
}

/**
 * Футер payloadcms.com: не «плитка колонок», а строки-ряды.
 * Слева — название раздела, справа — ссылки в строку; между рядами hairline.
 */
export function SiteFooter({
  description,
  groups,
  social,
  contactEmail,
  contactPhone,
  legal,
  locale,
}: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--pl-border)] bg-[var(--pl-bg)] pt-16 pb-10">
      <div className="px-[var(--pl-gutter)]">
        <div className="grid gap-10 pb-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="block h-3 w-3 bg-[var(--pl-accent)]" />
              <span className="text-[15px] font-medium">Plus In Plus</span>
            </div>
            <p className="pl-small mt-5 max-w-sm">{description}</p>
            <div className="mt-6 flex flex-col gap-1 text-[14px]">
              {contactEmail ? (
                <a className="pl-link w-fit" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              ) : null}
              {contactPhone ? (
                <a className="pl-link w-fit" href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}>
                  {contactPhone}
                </a>
              ) : null}
            </div>
            <ul className="mt-6 flex items-center gap-5">
              {social.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="pl-mono text-[11px] text-[var(--pl-muted)] transition-colors hover:text-[var(--pl-accent)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {groups.map((group) => (
              <div
                key={group.title}
                className="flex flex-col gap-3 border-t border-[var(--pl-border)] py-5 sm:flex-row sm:items-baseline sm:gap-8"
              >
                <h3 className="pl-mono w-40 shrink-0 text-[10px] text-[var(--pl-muted)]">
                  {group.title}
                </h3>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link
                        href={`/${locale}${link.href === "/" ? "" : link.href}`}
                        className="text-[15px] text-[var(--pl-text)]/85 transition-colors duration-150 hover:text-[var(--pl-accent)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--pl-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="pl-mono text-[10px] text-[var(--pl-muted)]">© 2026 Plus In Plus</p>
          <ul className="flex flex-wrap items-center gap-6">
            {legal.map((item) => (
              <li key={item.href}>
                <Link
                  href={`/${locale}${item.href}`}
                  className="pl-small text-[12px] transition-colors hover:text-[var(--pl-text)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
