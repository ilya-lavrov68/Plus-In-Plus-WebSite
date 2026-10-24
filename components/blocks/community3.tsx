import Link from "next/link";

import { BrandMark, TsConnectLogo } from "@/components/site/logo";
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
    <section id={id} className="py-32">
      <div className="container">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary" className="rounded-full border-0 bg-white/[0.055] px-3.5 py-1 text-xs backdrop-blur-xl">
            {badge}
          </Badge>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            {heading}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {description}
          </p>

          <div className="mt-12 grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="glass-surface rounded-2xl border-0 bg-white/[0.05] p-8 transition-transform duration-200 ease-out hover:-translate-y-1">
              <Link
                href="/"
                className="flex h-full flex-col items-center justify-center gap-4 text-center"
              >
                <div className="flex h-16 items-center justify-center">
                  <BrandMark className="h-10" label="Plus In Plus" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {studioDescription}
                </p>
              </Link>
            </Card>

            <Card className="glass-surface rounded-2xl border-0 bg-white/[0.05] p-8 transition-transform duration-200 ease-out hover:-translate-y-1">
              <a
                href="https://tsconnect.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center justify-center gap-4 text-center"
              >
                <div className="flex h-16 items-center justify-center">
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
