import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { BrandMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface Feature314SmallCard {
  image: string;
  topNote: string;
  title: string;
  summary: string;
  url: string;
}

export interface Feature314BigCard {
  image: string;
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
    image: "/assets/shop/bag-design.jpg",
    topNote: "Confidential workflow",
    title: "Everything is confidential",
    summary:
      "We do not share your information with anyone other than our partners, who help us with our work.",
    url: "/contact",
  },
  {
    image: "/assets/shop/sign-design-3.jpg",
    topNote: "Tailored approach",
    title: "Individual selection",
    summary: "We take an individualized approach with each person.",
    url: "/shop",
  },
];

const DEFAULT_BIG_CARD: Feature314BigCard = {
  image: "/assets/shop/outdoor-glass-poster.jpg",
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
    <section id={id} className="bg-muted py-32">
      <div className="container">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-8">
            <h2 className="max-w-lg flex-1 whitespace-pre-line text-3xl font-bold md:text-5xl">
              {heading}
            </h2>
            <Button asChild className="group w-fit rounded-xl">
              <Link href={button.url}>
                {button.text}
                <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {smallCards.map((card, idx) => (
              <Card
                key={idx}
                className="group col-span-1 rounded-xl border-0 p-4 shadow-none transition-colors duration-200 ease-out hover:bg-accent/50"
              >
                <Link
                  href={card.url}
                  className="flex h-full w-full flex-col justify-between gap-8"
                >
                  <div className="relative flex w-full items-start justify-between">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="size-24 rounded-xl object-cover lg:size-32"
                    />
                    <Plus
                      size={20}
                      className="rounded-full bg-secondary p-0.5 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground"
                    />
                  </div>
                  <div className="flex flex-col gap-4">
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

            <Card className="group min-h-[30rem] rounded-xl border-0 p-0 shadow-none md:col-span-2 md:min-h-[32rem]">
              <Link href={bigCard.url} className="block h-full">
                <div className="relative h-full w-full overflow-hidden rounded-xl">
                  <img
                    src={bigCard.image}
                    alt={bigCard.title}
                    className="aspect-[4/3] h-full w-full rounded-xl object-cover transition-opacity duration-300 ease-out group-hover:opacity-90"
                  />
                  <div className="pointer-events-none absolute top-0 flex w-full items-center justify-between p-8">
                    <BrandMark className="h-7" />
                    <Plus
                      size={20}
                      className="rounded-full bg-secondary p-0.5 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground"
                    />
                  </div>
                  <div className="pointer-events-none absolute bottom-0 flex w-full flex-col items-end justify-end bg-gradient-to-b from-black/0 to-black/95 p-10 text-right">
                    <h3 className="text-3xl font-medium text-white md:text-4xl">
                      {bigCard.title}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-white/80">
                      {bigCard.summary}
                    </p>
                  </div>
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
