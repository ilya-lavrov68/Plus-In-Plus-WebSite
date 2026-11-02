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
  eyebrow?: string;
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
  eyebrow = "How we work",
  heading = "Explore our creative\nstudio.",
  button = {
    text: "Contact us",
    url: "/contact",
  },
  smallCards = DEFAULT_SMALL_CARDS,
  bigCard = DEFAULT_BIG_CARD,
}: Feature314Props) => {
  return (
    <section id={id} className="motion-section border-y border-border bg-background py-24 md:py-32">
      <div className="container">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
            <div className="max-w-xl flex-1">
              <p className="pip-eyebrow" data-reveal="">
                {eyebrow}
              </p>
              <h2 className="mt-5 whitespace-pre-line text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              {heading.split("\n").map((line, index, lines) => (
                <Fragment key={`${index}-${line}`}>
                  <DecryptText text={line} seed={17 + index} className="block" />
                  {index < lines.length - 1 ? " " : null}
                </Fragment>
              ))}
              </h2>
            </div>
            <Button
              asChild
              className="group w-fit rounded-none"
              data-reveal=""
              data-reveal-delay={80}
            >
              <Link href={button.url}>
                {button.text}
                <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {smallCards.map((card, index) => (
              <Card
                key={card.title}
                data-reveal=""
                data-reveal-delay={index * 70}
                className="glass-surface group col-span-1 rounded-none border border-border/70 bg-card/60 p-3 transition-[background-color,border-color] duration-200 ease-out hover:border-primary/50 hover:bg-card"
              >
                <Link
                  href={card.url}
                  className="flex h-full w-full flex-col justify-between gap-6"
                >
                  <div className="relative h-40 overflow-hidden rounded-none border border-border/60">
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
                      className="absolute top-3 right-3 rounded-none bg-secondary p-0.5 transition-[transform,background-color,color] duration-200 ease-out group-hover:rotate-90 group-hover:bg-primary group-hover:text-primary-foreground"
                    />
                  </div>
                  <div className="flex flex-col gap-4 px-1 pb-1">
                    <span className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                      {card.topNote}
                    </span>
                    <h3 className="text-xl font-medium tracking-[-0.01em]">{card.title}</h3>
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
              className="glass-surface group min-h-[30rem] rounded-none border border-border/70 bg-card/60 p-2 transition-colors duration-200 ease-out hover:border-primary/50 md:col-span-2"
            >
              <Link href={bigCard.url} className="flex h-full flex-col">
                <div className="relative min-h-[24rem] flex-1 overflow-hidden rounded-none border border-border/60">
                  {bigCard.image ? (
                    <img
                      src={bigCard.image}
                      alt={bigCard.title}
                      className="h-full min-h-[24rem] w-full object-cover"
                    />
                  ) : (
                    <MediaPlaceholder className="h-full min-h-[24rem]" />
                  )}
                  <div className="pointer-events-none absolute top-0 flex w-full items-center justify-between p-6">
                    <BrandMark className="h-7" />
                    <Plus
                      size={20}
                      className="rounded-none bg-secondary p-0.5 transition-[transform,background-color,color] duration-200 ease-out group-hover:rotate-90 group-hover:bg-primary group-hover:text-primary-foreground"
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
