import Link from "next/link";

const columns = [
  [
    { label: "Servers", href: "/shop" },
    { label: "Socnet", href: "/#news" },
    { label: "About PIP", href: "/#partners" },
  ],
  [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "User Agreement", href: "/user-agreement" },
    { label: "Offer", href: "/offer" },
  ],
  [
    { label: "Account", href: "/?auth=login" },
    { label: "Collaboration", href: "/contact" },
    { label: "Partners", href: "/#partners" },
  ],
];

export function Footer() {
  return (
    <footer className="mt-auto overflow-hidden bg-[#052B42] text-white">
      <div className="mx-auto max-w-[1220px] px-5 pb-2 pt-16 sm:px-8 sm:pt-20 lg:px-6 lg:pt-[160px]">
        <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 sm:gap-x-12 sm:gap-y-10">
          {columns.map((column, index) => (
            <ul key={index} className="space-y-5 sm:space-y-6 lg:space-y-8">
              {column.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="rounded-sm font-body text-sm font-medium text-white/60 transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-base lg:text-lg"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <div aria-hidden="true" className="mt-16 border-t border-white/10 pt-10 sm:mt-20 sm:pt-12 lg:mt-[220px]">
          <p className="select-none whitespace-nowrap font-geist text-[clamp(8rem,22vw,24rem)] font-semibold leading-[0.72] tracking-[-0.085em] text-[#0A4366]">
            Plus in Plus
          </p>
        </div>
      </div>
    </footer>
  );
}
