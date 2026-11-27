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
      {/* Градиент владельца лежит всей секцией: без маски, скримов и сдвигов. */}
      <SectionGlow
        variant="dither"
        preset="hero"
        cell={HAZEGLOW_CELL.hero}
        mask={false}
        canvasFromPreset
        intensity={1}
      />
      <div className="container relative z-10">
        <h1 className="text-5xl leading-[0.92] font-medium tracking-tight text-balance sm:text-6xl md:text-7xl lg:text-[7.5rem]">
          <DecryptText
            text={headingMuted}
            trigger="mount"
            seed={3}
            className="block text-[#110f10]/70"
          />
          <DecryptText
            text={headingPrimary}
            trigger="mount"
            seed={5}
            className="mt-2 block text-[#110f10] md:mt-4"
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
            <Button
              variant="neutral"
              size="lg"
              asChild
              className="bg-[#2b292a] text-[#eeeeee] hover:bg-[#3a3838]"
            >
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
