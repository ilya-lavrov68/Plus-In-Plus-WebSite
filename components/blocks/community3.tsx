import Link from "next/link";

import { BrandMark, TsConnectLogo } from "@/components/site/logo";
import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  badge = "Partners & Neighbors",
  heading = "Our partners and neighbors",
  description = "We closely collaborate with TS Connect, an IT firm in Tambov, delivering reliable design and digital infrastructure for brands and organizations.",
  studioDescription = "Next-generation studio for brand systems, mockups, signage, and event collateral.",
  partnerDescription = "Regional IT engineering and digital infrastructure partner in Tambov.",
}: Community3Props) => {
  return (
    <section id={id} className="motion-section section-y">
      <div className="container">
        <div className="flex flex-col items-center text-center">
          <Badge
            variant="secondary"
            data-reveal=""
            className="rounded-full border-0 bg-white/[0.055] px-3.5 py-1 text-xs backdrop-blur-2xl"
          >
            {badge}
          </Badge>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            <DecryptText text={heading} seed={29} />
          </h2>
          <p
            data-reveal=""
            data-reveal-delay={60}
            className="mt-5 max-w-2xl text-lg leading-[1.75] text-muted-foreground"
          >
            {description}
          </p>

          <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-7 sm:grid-cols-2">
            <Card
              data-reveal=""
              data-reveal-delay={100}
              className="glass-surface group rounded-2xl border-0 bg-white/[0.05] p-8 transition-[background-color] duration-200 ease-out hover:bg-white/[0.08]"
            >
              <Link
                href="/"
                className="flex h-full flex-col items-center justify-center gap-4 text-center"
              >
                <div className="flex h-16 items-center justify-center transition-opacity duration-200 ease-out group-hover:opacity-80">
                  <BrandMark className="h-10" label="Plus In Plus" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {studioDescription}
                </p>
              </Link>
            </Card>

            <Card
              data-reveal=""
              data-reveal-delay={150}
              className="glass-surface group rounded-2xl border-0 bg-white/[0.05] p-8 transition-[background-color] duration-200 ease-out hover:bg-white/[0.08]"
            >
              <a
                href="https://tsconnect.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center justify-center gap-4 text-center"
              >
                <div className="flex h-16 items-center justify-center transition-opacity duration-200 ease-out group-hover:opacity-80">
                  <TsConnectLogo src={tsConnectLogoSrc} className="h-8" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {partnerDescription}
                </p>
              </a>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Community3 };
