import { ArrowRight, Award, Flag, Globe, Image as ImageIcon, Newspaper } from "lucide-react";
import Link from "next/link";

import { CategoryCard } from "@/components/site/category-card";
import { EmptyState } from "@/components/site/empty-state";
import { FeatureTable } from "@/components/site/feature-table";
import { NewsCarousel } from "@/components/site/news-carousel";
import { getPublishedPosts, toNewsItem } from "@/lib/data";

export const dynamic = "force-dynamic";

// Placeholder links: the services themselves live in the DB and are not seeded yet.
const categories = [
  { title: "Website design", icon: Globe },
  { title: "Badge design", icon: Award },
  { title: "Poster design", icon: ImageIcon },
  { title: "Banner mockup design", icon: Flag },
];

const features = [
  {
    title: "Everything is confidential",
    description:
      "We do not share your information with anyone other than our partners, who help us with our work.",
  },
  {
    title: "Individual selection",
    description: "We take an individualized approach with each person.",
  },
  {
    title: "Ongoing tech support",
    description: "We're always here to help if the design isn't quite right.",
  },
];

export default async function HomePage() {
  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Order a design you won&apos;t regret
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Have an idea but don’t know how to showcase it? We’ll package it in a stylish, clear
          design—from website mockups to posters and event collateral.
        </p>
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {categories.map(({ title, icon }) => (
              <li key={title}>
                <Link
                  href="#"
                  aria-label={title}
                  className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <CategoryCard title={title} icon={icon} />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 text-center sm:mt-12">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-sm text-xl font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              And other services
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>

          <div className="mt-16 sm:mt-20 [&_.border-t]:border-white/20 [&_dd]:text-white/70 [&_dt]:text-white">
            <FeatureTable features={features} />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
          <div className="flex items-center justify-center gap-6 sm:gap-8">
            <span className="text-2xl font-bold tracking-tight">Plus In Plus</span>
            <span aria-hidden="true" className="h-12 w-px bg-border" />
            <span className="text-2xl font-bold tracking-[0.2em]">TS CONNECT</span>
          </div>
          <p className="text-center text-lg leading-relaxed lg:text-left">
            Our partners and neighbors at TS Connect, an IT firm in Tambov, provide us with the
            resources we need to carry out our activities, and we, in turn, provide them with our
            services.
          </p>
        </div>
      </section>

      <section className="bg-lavender">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            News from Plus In Plus
          </h2>
          <div className="mt-10 sm:mt-12">
            {newsItems.length ? (
              <NewsCarousel items={newsItems} label="News from Plus In Plus" />
            ) : (
              <EmptyState
                icon={Newspaper}
                title="No news yet"
                description="Check back later for updates."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
