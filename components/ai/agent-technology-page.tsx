import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { AgentMechanism, type AgentMechanismKind } from "@/components/ai/agent-mechanism";
import { AgentShaderPlayer } from "@/components/ai/agent-shader-player";
import { Button } from "@/components/ui/button";
import { getRequestTranslations } from "@/lib/server-i18n";
import type { AgentKind } from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

type Benefit = { title: string; description: string };
type TechnologySection = {
  id: string;
  title: string;
  description: string;
  points: string[];
  mechanism: AgentMechanismKind;
  visualLabel: string;
  visualLabels: string[];
};
type AgentTechnologyContent = {
  name: string;
  title: string;
  intro: string;
  status: string;
  visualCaption: string;
  visualLabel: string;
  benefitsTitle: string;
  benefits: Benefit[];
  sections: TechnologySection[];
  closingTitle: string;
  closingDescription: string;
  closingPoints: string[];
  cautionTitle: string;
  cautionText: string;
  nextTitle: string;
};

export async function AgentTechnologyPage({ agent }: { agent: AgentKind }) {
  const t = await getRequestTranslations("agentPages");
  const content = t.raw(agent) as AgentTechnologyContent;
  const otherAgent: AgentKind = agent === "lumi" ? "kairo" : "lumi";
  const otherContent = t.raw(otherAgent) as AgentTechnologyContent;
  const shaderLabels = {
    play: t("animation.play"),
    pause: t("animation.pause"),
    resume: t("animation.resume"),
  };

  return (
    <>
      <div className="container flex flex-wrap items-center gap-4 pt-8 sm:pt-10">
        <Link
          href="/ai"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" />
          {t("back")}
        </Link>
        <nav aria-label={t("switcherLabel")} className="ml-auto flex items-center gap-2">
          {(["lumi", "kairo"] as const).map((item) => (
            <Button key={item} asChild size="sm" variant={agent === item ? "default" : "outline"}>
              <Link href={`/ai/${item}`} aria-current={agent === item ? "page" : undefined}>
                {item === "lumi" ? "Lumi Q1" : "Kairo"}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      <section className="container pb-24 pt-16 md:pb-32 md:pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 xl:gap-32">
          <div data-reveal="" className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">{t(`${agent}.name`)} / Lumina</p>
            <h1 className="mt-7 text-6xl font-medium tracking-tight sm:text-7xl xl:text-8xl">{content.name}</h1>
            <p className="mt-8 max-w-xl text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              {content.title}
            </p>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {content.intro}
            </p>
            <p className="mt-10 max-w-xl border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
              {content.status}
            </p>
          </div>

          <figure data-reveal="" data-reveal-delay={100} className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>{content.visualCaption}</span>
              <span aria-hidden="true">01 / 06</span>
            </div>
            <div className="aspect-[36/23] w-full border-y border-border bg-background text-foreground">
              <AgentShaderPlayer agent={agent} labels={shaderLabels} />
            </div>
            <figcaption className="sr-only">{content.visualLabel}</figcaption>
          </figure>
        </div>
      </section>

      <section className="border-t border-border py-24 md:py-32" aria-labelledby={`${agent}-benefits`}>
        <div className="container">
          <div className="max-w-2xl" data-reveal="">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">02 / {t("advantages")}</p>
            <h2 id={`${agent}-benefits`} className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">
              {content.benefitsTitle}
            </h2>
          </div>
          <div className="mt-16 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-10">
            {content.benefits.map((benefit, index) => (
              <article key={benefit.title} data-reveal="" data-reveal-delay={Math.min(index * 80, 240)}>
                <span aria-hidden="true" className="font-mono text-xs text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-lg font-medium leading-snug">{benefit.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {content.sections.map((section, index) => (
        <section id={section.id} key={section.id} className="border-t border-border py-24 md:py-32">
          <div className="container grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-24 xl:gap-32">
            <div
              data-reveal=""
              className={cn("min-w-0", index % 2 === 1 && "lg:order-2")}
            >
              <span aria-hidden="true" className="font-mono text-xs text-primary">
                {String(index + 3).padStart(2, "0")}
              </span>
              <h2 className="mt-5 max-w-lg text-3xl font-medium tracking-tight sm:text-4xl">{section.title}</h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {section.description}
              </p>
              <ul className="mt-10 space-y-5">
                {section.points.map((point) => (
                  <li key={point} className="flex max-w-xl items-start gap-4 text-sm leading-relaxed text-foreground/85 sm:text-base">
                    <span aria-hidden="true" className="mt-3 h-px w-5 shrink-0 bg-primary/70" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal="" data-reveal-delay={100} className="min-w-0">
              <AgentMechanism
                kind={section.mechanism}
                description={section.visualLabel}
                labels={section.visualLabels}
              />
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-border py-24 md:py-32">
        <div className="container grid gap-14 lg:grid-cols-2 lg:gap-24 xl:gap-32">
          <div data-reveal="">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">06 / {t("boundaries")}</p>
            <h2 className="mt-5 max-w-xl text-3xl font-medium tracking-tight sm:text-4xl">{content.closingTitle}</h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {content.closingDescription}
            </p>
          </div>
          <div data-reveal="" data-reveal-delay={100}>
            <ul className="space-y-6">
              {content.closingPoints.map((point) => (
                <li key={point} className="border-t border-border pt-5 text-sm leading-relaxed text-foreground/85 sm:text-base">
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-12">
              <h3 className="text-sm font-semibold">{content.cautionTitle}</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{content.cautionText}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16 md:py-20">
        <div className="container">
          <Link href={`/ai/${otherAgent}`} className="group flex items-end justify-between gap-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("nextAgent")}</p>
              <p className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{content.nextTitle}</p>
            </div>
            <span className="flex items-center gap-4 text-lg font-medium">
              {otherContent.name}
              <ArrowRight aria-hidden="true" className="size-6 text-primary transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
