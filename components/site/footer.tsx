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
    <footer className="mt-auto overflow-hidden bg-[#0a2540] text-white">
      <div className="mx-auto max-w-[1320px] px-5 pb-0 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-9 sm:grid-cols-3 sm:gap-10">
          {columns.map((column, index) => (
            <ul key={index} className="space-y-4 sm:space-y-5">
              {column.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="rounded-sm text-sm font-medium text-white/75 transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <div aria-hidden="true" className="mt-12 border-t border-white/10 pt-8 sm:mt-16 sm:pt-10 lg:mt-20">
          <p className="select-none whitespace-nowrap text-[clamp(4.5rem,18vw,15rem)] font-semibold leading-[0.72] tracking-[-0.085em] text-[#102e49]">
            Plus in Plus
          </p>
        </div>
      </div>
    </footer>
  );
}
