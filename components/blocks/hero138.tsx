import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HeroQuickLink {
  label: string;
  href: string;
  hint?: string;
}

export interface Hero138Props {
  /** Mono-подпись над заголовком. */
  eyebrow?: string;
  /** Нейтральная первая строка заголовка. */
  headingMuted?: string;
  /** Основная строка заголовка. */
  headingPrimary?: string;
  /** Одно акцентное слово в конце заголовка. */
  headingAccent?: string;
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
  /** Статусная строка под кнопками: короткая, техничная. */
  footnote?: string;
  /** Правая колонка быстрых переходов, как список действий в структуре Payload. */
  quickLinks?: HeroQuickLink[];
  className?: string;
}

const DEFAULT_QUICK_LINKS: HeroQuickLink[] = [
  { label: "Каталог услуг", href: "/services", hint: "13 позиций" },
  { label: "ИИ-агенты", href: "/ai", hint: "Lumi Q1 · Kairo" },
  { label: "Обсудить проект", href: "/contact", hint: "Бриф за 5 минут" },
];

/**
 * Hero в структуре payloadcms.com: mono-подпись, крупный заголовок слева,
 * короткое описание и две pill-кнопки. Справа — узкая колонка быстрых
 * переходов вместо декоративных орнаментов. Медиа-кадр добавляется отдельной
 * секцией ниже, поэтому первый экран остаётся типографическим и быстрым.
 */
const Hero138 = ({
  headingMuted = "Дизайн, который",
  headingPrimary = "работает",
  headingAccent = "на улице",
  eyebrow = "Plus In Plus · design + AI",
  descriptionLead = "Студия визуальных систем, вывесок и наружной рекламы. ",
  descriptionStrong = "Lumi Q1 и Kairo — ИИ-агенты для кода и права.",
  primaryCta = {
    label: "Обсудить проект",
    href: "/contact",
  },
  secondaryCta = {
    label: "Смотреть услуги",
    href: "/services",
  },
  footnote = "Открыт бриф · ответ в течение дня",
  quickLinks = DEFAULT_QUICK_LINKS,
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "motion-section relative border-b border-border/70 bg-background",
        className
      )}
    >
      <div className="container grid items-start gap-14 pt-16 pb-14 md:pt-24 md:pb-20 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
        <div>
          <p className="pip-mono" data-reveal="" data-reveal-delay={0}>
            {eyebrow}
          </p>

          <h1 className="mt-7 text-[clamp(2.55rem,6.2vw,5rem)] leading-[0.96] font-semibold tracking-[-0.045em]">
            {headingMuted ? (
              <span className="block text-muted-foreground">{headingMuted}</span>
            ) : null}
            <span className="block text-foreground">
              {headingPrimary}
              {headingAccent ? (
                <>
                  {" "}
                  <span className="text-primary">{headingAccent}</span>
                </>
              ) : null}
            </span>
          </h1>

          <p
            data-reveal=""
            data-reveal-delay={80}
            className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            {descriptionLead}
            {descriptionStrong ? (
              <span className="text-foreground">{descriptionStrong}</span>
            ) : null}
          </p>

          <div
            data-reveal=""
            data-reveal-delay={140}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            {primaryCta ? (
              <Button size="lg" asChild>
                <Link href={primaryCta.href}>{primaryCta.label}</Link>
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button variant="outline" size="lg" asChild>
                <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
              </Button>
            ) : null}
          </div>

          {footnote ? (
            <p className="pip-mono mt-10 flex items-center gap-2">
              <span className="inline-block size-1.5 bg-primary" aria-hidden="true" />
              {footnote}
            </p>
          ) : null}
        </div>

        {quickLinks.length > 0 ? (
          <aside
            data-reveal=""
            data-reveal-delay={180}
            className="hidden lg:block"
            aria-label={eyebrow}
          >
            <p className="pip-mono border-b border-border/70 pb-3">
              Быстрый доступ
            </p>
            <ul className="divide-y divide-border/70">
              {quickLinks.map((link, index) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-baseline justify-between gap-4 py-4 transition-colors duration-150 hover:text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="pip-mono text-[10px] text-muted-foreground/60">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium">{link.label}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {link.hint ? (
                        <span className="pip-mono text-[10px] opacity-70">
                          {link.hint}
                        </span>
                      ) : null}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:text-primary"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
};

export { Hero138 };
