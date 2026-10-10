import { Logo } from "@/components/site/logo";

export function PartnersSection() {
  return (
    <section id="partners" aria-labelledby="partners-heading" className="bg-white">
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
        <div className="flex items-center justify-center lg:justify-start">
          {/* Combined brand lockup: Plus In Plus | TS CONNECT (single SVG). */}
          <Logo
            variant="partners"
            className="w-full max-w-[420px] sm:max-w-[500px]"
          />
        </div>

        <div>
          <h2 id="partners-heading" className="sr-only">
            Our partners
          </h2>
          <p className="text-center font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:text-left">
            Our partners and neighbors at TS Connect, an IT firm in Tambov, provide us with the
            resources we need to carry out our activities, and we, in turn, provide them with our
            services.
          </p>
        </div>
      </div>
    </section>
  );
}
