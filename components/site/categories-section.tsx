import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryCard } from "@/components/site/category-card";

const categories = [
  { title: "Website mockup", gradientImageSrc: "/assets/gradients/category-bg.svg" },
  { title: "Badge design", gradientImageSrc: "/assets/gradients/category-bg2.svg" },
  { title: "Poster design", gradientImageSrc: "/assets/gradients/category-bg3.svg" },
  { title: "Banner design", gradientImageSrc: "/assets/gradients/category-bg4.svg" },
];

export function CategoriesSection() {
  return (
    <section id="categories" aria-labelledby="categories-heading" className="bg-white text-[#052B42]">
      <div className="mx-auto max-w-[1508px] px-5 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-24 min-[1508px]:px-0 lg:pb-[110px] lg:pt-[100px]">
        <div className="mx-auto max-w-[820px] text-center">
          <h2
            id="categories-heading"
            className="font-geist text-[clamp(1.15rem,3vw,3rem)] font-semibold leading-tight tracking-[-0.045em] sm:whitespace-nowrap"
          >
            Order a design you won&apos;t regret
          </h2>
          <p className="mx-auto mt-5 max-w-[760px] font-body text-base leading-7 text-[#052B42] sm:mt-10 sm:text-lg sm:leading-8 lg:mt-14 lg:text-xl">
            Have an idea but don&apos;t know how to showcase it? We&apos;ll package it in a stylish,
            clear design—from website mockups to posters and event collateral.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:mt-12 sm:gap-6 xl:mt-20 xl:grid-cols-4 xl:gap-9">
          {categories.map((category) => (
            <li key={category.title}>
              <CategoryCard {...category} href="/shop" />
            </li>
          ))}
        </ul>

        <div className="mt-9 text-center sm:mt-12 xl:mt-24">
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 rounded-sm font-body text-base font-medium text-[#052B42] underline-offset-4 transition-colors duration-200 ease-out hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            And other services
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
