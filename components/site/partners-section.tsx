import { BrandMark } from "@/components/site/brand-mark";

export function PartnersSection() {
  return (
    <section id="partners" aria-labelledby="partners-heading" className="bg-white">
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:justify-start">
          <BrandMark
            iconClassName="h-9 w-9"
            textClassName="text-lg sm:text-xl"
            className="gap-2"
          />
          <span aria-hidden="true" className="h-12 w-px bg-slate-200 sm:h-14" />
          <span className="inline-flex items-center gap-2 text-lg font-extrabold tracking-[0.16em] text-[#0a2540] sm:text-xl">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#64cb70]" />
            TS CONNECT
          </span>
        </div>

        <div>
          <h2 id="partners-heading" className="sr-only">
            Our partners
          </h2>
          <p className="text-center text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:text-left">
            Our partners and neighbors at TS Connect, an IT firm in Tambov, provide us with the
            resources we need to carry out our activities, and we, in turn, provide them with our
            services.
          </p>
        </div>
      </div>
    </section>
  );
}
