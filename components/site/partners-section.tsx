import { Logo } from "@/components/site/logo";

export function PartnersSection() {
  return (
    <section id="partners" aria-labelledby="partners-heading" className="bg-white text-[#052B42]">
      <div className="mx-auto grid min-h-[400px] max-w-[1740px] items-center gap-12 px-5 py-24 sm:px-8 lg:min-h-[688px] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:px-10 lg:py-0">
        <div className="flex items-center justify-center lg:justify-start">
          <Logo
            variant="partners"
            className="h-auto w-full max-w-[683px]"
          />
        </div>

        <div>
          <h2 id="partners-heading" className="sr-only">
            Our partners
          </h2>
          <p className="mx-auto max-w-[700px] text-center font-body text-base leading-7 text-[#052B42] sm:text-lg sm:leading-8 lg:ml-auto lg:text-right lg:text-xl">
            Our partners and neighbors at TS Connect, an IT firm in Tambov, provide us with the
            resources we need to carry out our activities, and we, in turn, provide them with our
            services.
          </p>
        </div>
      </div>
    </section>
  );
}
