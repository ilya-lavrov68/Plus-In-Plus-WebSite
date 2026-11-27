import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DecryptText } from "@/components/site/motion/decrypt-text";
import { SectionGlow } from "@/components/site/section-glow";
import { Button } from "@/components/ui/button";
import { HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { cn } from "@/lib/utils";

export interface Hero138Props {
  headingMuted?: string;
  headingPrimary?: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  className?: string;
}

/**
 * Первый экран: имя студии и два действия.
 *
 * Ни описания, ни подписи, ни панели — принцип как у Google и JetBrains:
 * один короткий тезис, читаемый за секунду, и две кнопки. Всё остальное
 * начинается ниже. Фон секции — анимированный крупный dither.
 */
const Hero138 = ({
  headingMuted = "Дизайн-студия",
  headingPrimary = "Plus In Plus",
  primaryCta = {
    label: "Обсудить проект",
    href: "/contact",
  },
  secondaryCta = {
    label: "Смотреть работы",
    href: "/work",
  },
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "motion-section relative flex min-h-[72vh] items-end overflow-hidden bg-background pt-32 pb-16 md:min-h-[80vh] md:pb-24",
        className,
      )}
    >
      <SectionGlow variant="dither" cell={HAZEGLOW_CELL.hero} intensity={1} />
      {/* Скрим только под типографикой: правый край отдан растру. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(17,15,16,0.12)_0%,rgba(17,15,16,0.36)_28%,rgba(17,15,16,0.86)_42%,#110f10_54%)] lg:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,#110f10_0%,#110f10_46%,rgba(17,15,16,0.95)_56%,rgba(17,15,16,0.62)_68%,rgba(17,15,16,0.18)_79%,rgba(17,15,16,0)_88%)] lg:block"
      />
      {/* Нижняя кромка растворяется, иначе на границе секции виден шов. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_top,#110f10_0%,rgba(17,15,16,0.85)_45%,rgba(17,15,16,0)_100%)]"
      />
      <div className="container relative z-10">
        <h1 className="text-5xl leading-[0.92] font-medium tracking-tight text-balance sm:text-6xl md:text-7xl lg:text-[7.5rem]">
          <DecryptText
            text={headingMuted}
            trigger="mount"
            seed={3}
            className="block text-muted-foreground"
          />
          <DecryptText
            text={headingPrimary}
            trigger="mount"
            seed={5}
            className="mt-2 block text-foreground md:mt-4"
          />
        </h1>

        <div
          data-reveal=""
          data-reveal-delay={120}
          className="mt-10 flex flex-wrap items-center gap-3 md:mt-14"
        >
          {primaryCta && (
            <Button size="lg" asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
          )}
          {secondaryCta && (
            <Button variant="neutral" size="lg" asChild>
              <Link href={secondaryCta.href} className="group">
                {secondaryCta.label}
                <ArrowRight className="ml-1 size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export { Hero138 };
