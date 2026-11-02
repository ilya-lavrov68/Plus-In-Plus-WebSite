import Link from "next/link";

import { Button } from "@/components/ui/button";

export interface Cta13Props {
  heading?: string;
  description?: string;
  primaryButton?: {
    text: string;
    url: string;
  };
  secondaryButton?: {
    text: string;
    url: string;
  };
}

/**
 * Финальный CTA в структуре payloadcms.com: простая полоса с крупным
 * заголовком по центру и двумя pill-кнопками. Без карточки, без орнаментов
 * и без второго визуального центра — экран остаётся спокойным.
 */
const Cta13 = ({
  heading = "Соберём форму вашей идеи.",
  description = "Расскажите о задаче — соберём айдентику, макет или вывеску.",
  primaryButton = {
    text: "Обсудить проект",
    url: "/contact",
  },
  secondaryButton,
}: Cta13Props) => {
  return (
    <section className="motion-section border-t border-border/70 py-24 md:py-32">
      <div className="container">
        <div
          data-reveal=""
          className="mx-auto flex max-w-2xl flex-col items-center text-center"
        >
          <h2 className="text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-4xl md:text-[2.75rem]">
            {heading}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href={primaryButton.url}>{primaryButton.text}</Link>
            </Button>
            {secondaryButton ? (
              <Button size="lg" variant="outline" asChild>
                <Link href={secondaryButton.url}>{secondaryButton.text}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta13 };
