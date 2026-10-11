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
    <section id="categories" aria-labelledby="categories-heading" className="bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="categories-heading"
            className="whitespace-nowrap font-geist text-[clamp(1rem,5.5vw,1.5rem)] font-semibold leading-tight tracking-[-0.045em] text-[#052B42] sm:text-2xl md:text-3xl lg:text-4xl"
          >
            Order a design you won&apos;t regret
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center font-body text-base leading-7 text-[#052B42] sm:text-lg sm:leading-8">
            Have an idea but don&apos;t know how to showcase it? We&apos;ll package it in a stylish,
            clear design—from website mockups to posters and event collateral.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {categories.map((category) => (
            <li key={category.title}>
              <CategoryCard {...category} href="/shop" />
            </li>
          ))}
        </ul>

        <div className="mt-9 text-center sm:mt-11">
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 rounded-sm font-body text-base font-semibold text-[#052B42] underline-offset-4 transition-colors duration-200 ease-out hover:text-[#052B42] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
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
