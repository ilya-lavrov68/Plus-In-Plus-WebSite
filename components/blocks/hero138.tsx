import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DotLattice, PixelMosaic } from "@/components/site/brand-geometry";
import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Hero138Props {
  /** Верхняя строка заголовка: нейтральная, задаёт масштаб. */
  headingMuted?: string;
  /** Вторая строка заголовка: основной off-white текст. */
  headingPrimary?: string;
  /** Короткий сигнальный хвост второй строки: акцент, не более одного слова. */
  headingAccent?: string;
  eyebrow?: string;
  descriptionLead?: string;
  descriptionStrong?: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  footnote?: string;
  className?: string;
}

/**
 * Hero бренда «сигнальная форма»: симметричная композиция по центру, крупная
 * двухстрочная типографика с одним акцентным словом, острая основная кнопка и
 * pill-кнопка вторичного действия. По нижним углам — детерминированные
 * пиксельная мозаика и полудроп-решётка; они декоративны и скрыты от AT.
 */
const Hero138 = ({
  headingMuted = "Where an idea",
  headingPrimary = "takes",
  headingAccent = "shape",
  eyebrow = "Plus In Plus — design + AI",
  descriptionLead = "A studio for brand systems, signage and outdoor media. ",
  descriptionStrong = "Lumi Q1 and Kairo — specialised AI agents for code and law.",
  primaryCta = {
    label: "Order a design",
    href: "/services",
  },
  secondaryCta = {
    label: "Explore AI",
    href: "/ai",
  },
  footnote = "Plus In Plus · form, code and meaning",
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "motion-section relative isolate overflow-hidden bg-background pt-24 pb-40 sm:pb-56 md:pt-32 md:pb-64",
        className
      )}
    >
      {/*
       * Фон повторяет референс: редкая сетка точек на весь экран.
       * Линии крупной сетки остаются другим разделам — так главная не
       * выглядит как шаблон, а орнаменты в углах читаются отдельно.
       */}
      <div
        aria-hidden="true"
        className="pip-dot-field pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]"
      />

      <div className="container relative z-10 flex flex-col items-center text-center">
        <p className="pip-eyebrow" data-reveal="" data-reveal-delay={0}>
          {eyebrow}
        </p>

        <h1 className="mt-8 max-w-4xl text-[clamp(2.5rem,7.2vw,5.75rem)] leading-[0.98] font-bold tracking-[-0.035em]">
          {headingMuted ? (
            <span className="block text-muted-foreground">
              <DecryptText text={headingMuted} trigger="mount" seed={3} />
            </span>
          ) : null}
          <span className="block text-foreground">
            <DecryptText text={headingPrimary} trigger="mount" seed={5} />
            {headingAccent ? (
              <>
                {" "}
                <span className="pip-mark text-primary">
                  <DecryptText text={headingAccent} trigger="mount" seed={7} />
                </span>
              </>
            ) : null}
          </span>
        </h1>

        <p
          data-reveal=""
          data-reveal-delay={90}
          className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          {descriptionLead}
          {descriptionStrong ? (
            <strong className="font-medium text-foreground">
              {descriptionStrong}
            </strong>
          ) : null}
        </p>

        <div
          data-reveal=""
          data-reveal-delay={140}
          className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          {primaryCta ? (
            <Button size="lg" asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
          ) : null}
          {secondaryCta ? (
            <Button variant="outline" size="lg" asChild>
              <Link href={secondaryCta.href} className="group">
                {secondaryCta.label}
                <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : null}
        </div>

        {footnote ? (
          <p className="mt-8 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/80 uppercase">
            {footnote}
          </p>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 hidden h-72 overflow-hidden opacity-95 [mask-image:linear-gradient(to_top,black_72%,transparent)] sm:block sm:h-80 md:h-[26rem]"
      >
        {/* Волны окутывают нижние углы: пиксельная масса слева, решётка
            окружностей справа. Гребень мягко растворяется, поэтому текст и
            кнопки всегда читаются поверх. */}
        <PixelMosaic
          className="absolute bottom-0 left-0 h-full w-[34%] max-w-[22rem]"
          cols={18}
          rows={16}
          seed={11}
        />
        <DotLattice
          className="absolute right-0 bottom-0 h-full w-[32%] max-w-[22rem]"
          cols={22}
          rows={16}
          seed={23}
        />
      </div>
    </section>
  );
};

export { Hero138 };
