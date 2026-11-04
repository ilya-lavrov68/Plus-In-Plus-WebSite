import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { BrandMark } from "@/components/site/logo";
import { DecryptText } from "@/components/site/motion/decrypt-text";
import { MediaPlaceholder } from "@/components/site/media-placeholder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface Feature314SmallCard {
  image?: string;
  topNote: string;
  title: string;
  summary: string;
  url: string;
}

export interface Feature314BigCard {
  image?: string;
  label: string;
  title: string;
  summary: string;
  url: string;
}

export interface Feature314Props {
  id?: string;
  heading?: string;
  button?: {
    text: string;
    url: string;
  };
  smallCards?: Feature314SmallCard[];
  bigCard?: Feature314BigCard;
}

const DEFAULT_SMALL_CARDS: Feature314SmallCard[] = [
  {
    topNote: "Confidential workflow",
    title: "Everything is confidential",
    summary:
      "We do not share your information with anyone other than our partners, who help us with our work.",
    url: "/contact",
  },
  {
    topNote: "Tailored approach",
    title: "Individual selection",
    summary: "We take an individualized approach with each person.",
    url: "/services",
  },
];

const DEFAULT_BIG_CARD: Feature314BigCard = {
  label: "Plus In Plus®",
  title: "Ongoing tech support",
  summary: "We're always here to help if the design isn't quite right.",
  url: "/contact",
};

const Feature314 = ({
  id = "features",
  heading = "Explore our creative\nstudio.",
  button = {
    text: "Contact us",
    url: "/contact",
  },
  smallCards = DEFAULT_SMALL_CARDS,
  bigCard = DEFAULT_BIG_CARD,
}: Feature314Props) => {
  return (
    <section id={id} className="motion-section bg-muted section-y">
      <div className="container">
        <div className="flex flex-col gap-14 md:gap-16">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end md:gap-10">
            <h2 className="max-w-lg flex-1 whitespace-pre-line text-3xl font-bold md:text-5xl">
              {heading.split("\n").map((line, index, lines) => (
                <Fragment key={`${index}-${line}`}>
                  <DecryptText text={line} seed={17 + index} className="block" />
                  {index < lines.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h2>
            <Button
              asChild
              className="group w-fit rounded-xl"
              data-reveal=""
              data-reveal-delay={80}
            >
              <Link href={button.url}>
                {button.text}
                <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            {smallCards.map((card, index) => (
              <Card
                key={card.title}
                data-reveal=""
                data-reveal-delay={index * 70}
                className="glass-surface group col-span-1 rounded-[1.5rem] border-0 bg-white/[0.065] p-4 transition-[background-color] duration-200 ease-out hover:bg-white/[0.09]"
              >
                <Link
                  href={card.url}
                  className="flex h-full w-full flex-col justify-between gap-7"
                >
                  <div className="relative h-40 overflow-hidden rounded-[1.15rem]">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        className="h-full min-h-40 w-full object-cover"
                      />
                    ) : (
                      <MediaPlaceholder
                        className="h-full min-h-40"
                        markClassName="h-9"
                      />
                    )}
                    <Plus
                      size={20}
                      className="absolute top-3 right-3 rounded-full bg-secondary p-0.5 transition-[transform,background-color,color] duration-200 ease-out group-hover:rotate-90 group-hover:bg-foreground group-hover:text-background"
                    />
                  </div>
                  <div className="flex flex-col gap-4 px-1.5 pb-1.5">
                    <span className="text-xs text-muted-foreground">
                      {card.topNote}
                    </span>
                    <h3 className="text-xl font-medium">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {card.summary}
                    </p>
                  </div>
                </Link>
              </Card>
            ))}

            <Card
              data-reveal=""
              data-reveal-delay={120}
              className="glass-surface group min-h-[30rem] rounded-[1.75rem] border-0 bg-white/[0.065] p-2 md:col-span-2"
            >
              <Link href={bigCard.url} className="flex h-full flex-col">
                <div className="relative min-h-[24rem] flex-1 overflow-hidden rounded-[1.35rem]">
                  {bigCard.image ? (
                    <img
                      src={bigCard.image}
                      alt={bigCard.title}
                      className="h-full min-h-[24rem] w-full object-cover"
                    />
                  ) : (
                    <MediaPlaceholder className="h-full min-h-[24rem]" />
                  )}
                  <div className="pointer-events-none absolute top-0 flex w-full items-center justify-between p-8">
                    <BrandMark className="h-7" />
                    <Plus
                      size={20}
                      className="rounded-full bg-secondary p-0.5 transition-[transform,background-color,color] duration-200 ease-out group-hover:rotate-90 group-hover:bg-foreground group-hover:text-background"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-end sm:p-6">
                  <h3 className="text-2xl font-medium md:text-3xl">
                    {bigCard.title}
                  </h3>
                  <p className="max-w-sm text-sm text-muted-foreground sm:text-right">
                    {bigCard.summary}
                  </p>
                </div>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Feature314 };
