import Link from "next/link";

import { BrandMark, TsConnectLogo } from "@/components/site/logo";
import { DecryptText } from "@/components/site/motion/decrypt-text";


export interface Community3Props {
  id?: string;
  tsConnectLogoSrc?: string;
  badge?: string;
  heading?: string;
  description?: string;
  studioDescription?: string;
  partnerDescription?: string;
}

const Community3 = ({
  id = "community",
  tsConnectLogoSrc = "/assets/logos/ts-connect.svg",
  heading = "Our partners and neighbors",
  description = "We closely collaborate with TS Connect, an IT firm in Tambov, delivering reliable design and digital infrastructure for brands and organizations.",
  studioDescription = "Next-generation studio for brand systems, mockups, signage, and event collateral.",
  partnerDescription = "Regional IT engineering and digital infrastructure partner in Tambov.",
}: Community3Props) => {
  return (
    <section id={id} className="motion-section section-y">
      <div className="container">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            <DecryptText text={heading} seed={29} />
          </h2>
          <p
            data-reveal=""
            data-reveal-delay={60}
            className="mt-5 max-w-2xl text-lg leading-[1.75] text-muted-foreground"
          >
            {description}
          </p>

          {/*
            Логотипы партнёров живут строкой на общем фоне: две одинаковые
            карточки с подложкой выглядели как прайс, а не как сообщество.
          */}
          <div className="mt-14 flex w-full max-w-3xl flex-col items-stretch gap-8 sm:flex-row sm:items-center sm:justify-center sm:gap-16">
            <Link
              href="/studio"
              className="group flex items-center justify-center rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <BrandMark className="h-9 transition-opacity duration-200 ease-out group-hover:opacity-85" label="Plus In Plus" />
            </Link>

            <span aria-hidden="true" className="mx-auto h-px w-12 bg-white/12 sm:h-14 sm:w-px" />

            <a
              href="https://tsconnect.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <TsConnectLogo src={tsConnectLogoSrc} className="h-7 transition-opacity duration-200 ease-out group-hover:opacity-85" />
            </a>
          </div>

          <div className="mt-8 grid w-full max-w-3xl gap-3 text-sm leading-[1.7] text-muted-foreground sm:grid-cols-2 sm:gap-10">
            <p>{studioDescription}</p>
            <p>{partnerDescription}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Community3 };
