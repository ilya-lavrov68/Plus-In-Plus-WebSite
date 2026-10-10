import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryCard } from "@/components/site/category-card";

const categories = [
  { title: "Website mockup", gradientImageSrc: "/assets/gradients/category-bg.png" },
  { title: "Badge design", gradientImageSrc: "/assets/gradients/category-bg.png" },
  { title: "Poster design", gradientImageSrc: "/assets/gradients/category-bg.png" },
  { title: "Banner design", gradientImageSrc: "/assets/gradients/category-bg.png" },
];

export function CategoriesSection() {
  return (
    <section id="categories" aria-labelledby="categories-heading" className="bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="max-w-3xl">
          <h2
            id="categories-heading"
            className="text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#0a2540] sm:text-4xl lg:text-[3.25rem]"
          >
            Order a design you won&apos;t regret
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
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
            className="group inline-flex items-center gap-2 rounded-sm text-base font-semibold text-[#0a2540] underline-offset-4 transition-colors duration-200 ease-out hover:text-[#397248] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
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
