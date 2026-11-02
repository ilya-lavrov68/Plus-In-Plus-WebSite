import Link from "next/link";
import { ArrowRight, CircuitBoard, Code2, PenTool, Scale, type LucideIcon } from "lucide-react";

import { AgentShaderPlayer } from "@/components/ai/agent-shader-player";
import { Button } from "@/components/ui/button";
import { getRequestTranslations } from "@/lib/server-i18n";
import { cn } from "@/lib/utils";

interface AgentSectionProps {
  id: string;
  agent: "lumi" | "kairo";
  index: string;
  name: string;
  role: string;
  status: string;
  description: string;
  benefitsTitle: string;
  benefits: string[];
  detailsLink: string;
  note: string;
  visualLabel: string;
  shaderLabels: {
    play: string;
    pause: string;
    resume: string;
  };
  icon: LucideIcon;
  reverse?: boolean;
}

function AgentSection({
  id,
  agent,
  index,
  name,
  role,
  status,
  description,
  benefitsTitle,
  benefits,
  detailsLink,
  note,
  visualLabel,
  shaderLabels,
  icon: Icon,
  reverse = false,
}: AgentSectionProps) {
  return (
    <section id={id} className="border-t border-border py-24 md:py-36">
      <div className="container grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-24 xl:gap-32">
        <figure
          data-reveal=""
          className={cn("min-w-0", reverse && "lg:order-2")}
        >
          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 text-xs">
            <span className="font-mono text-muted-foreground">{index}</span>
            <span className="font-medium text-muted-foreground">{status}</span>
          </div>
          <div className="mt-6 aspect-[36/23] w-full border-y border-border bg-background text-foreground">
            <AgentShaderPlayer key={agent} agent={agent} labels={shaderLabels} />
          </div>
          <figcaption className="sr-only">{visualLabel}</figcaption>
        </figure>

        <div data-reveal="" data-reveal-delay={100} className="min-w-0">
          <Icon aria-hidden="true" className="size-7 text-foreground/70" strokeWidth={1.5} />
          <p className="mt-8 text-sm font-medium text-foreground/80">{role}</p>
          <h2 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">{name}</h2>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>

          <h3 className="mt-12 text-sm font-semibold text-foreground">{benefitsTitle}</h3>
          <ol className="mt-6 space-y-6">
            {benefits.map((benefit, benefitIndex) => (
              <li key={benefit} className="flex items-start gap-5 border-t border-border pt-5">
                <span aria-hidden="true" className="mt-1 shrink-0 font-mono text-xs text-muted-foreground">
                  {String(benefitIndex + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 text-sm leading-relaxed text-foreground/85 sm:text-base">{benefit}</span>
              </li>
            ))}
          </ol>
          <Link
            href={`/ai/${agent}`}
            className="group mt-9 inline-flex items-center gap-3 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            {detailsLink}
            <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-[color,transform] group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
          <p className="mt-9 max-w-xl border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}

export async function AiPageView() {
  const t = await getRequestTranslations("ai");
  const lumiBenefits = t.raw("lumi.benefits") as string[];
  const kairoBenefits = t.raw("kairo.benefits") as string[];
  const shaderLabels = {
    play: t("animation.play"),
    pause: t("animation.pause"),
    resume: t("animation.resume"),
  };

  return (
    <>
      <section className="relative isolate overflow-hidden bg-background pt-20 pb-24 md:pt-28 md:pb-32">
        <div
          aria-hidden="true"
          className="pip-hairline-grid pointer-events-none absolute inset-0 opacity-70"
        />
        <div className="container relative z-10">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20">
            <div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="pip-eyebrow">{t("eyebrow")}</p>
                <span className="text-xs text-muted-foreground">{t("announcement")}</span>
              </div>
              <h1 className="mt-8 max-w-4xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl lg:text-7xl">
                {t("title")}
              </h1>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:justify-self-end">
              {t("intro")}
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/ai/lumi">Lumi Q1</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/ai/kairo">Kairo</Link>
            </Button>
          </div>

          <aside
            data-reveal=""
            className="mt-16 flex max-w-4xl items-start gap-5 border-t border-border pt-7"
            aria-label={t("integrationNoticeTitle")}
          >
            <CircuitBoard aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("integrationNoticeTitle")}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("integrationNotice")}</p>
            </div>
          </aside>
        </div>
      </section>

      <AgentSection
        id="lumi-q1"
        agent="lumi"
        index={t("lumi.index")}
        name="Lumi Q1"
        role={t("lumi.role")}
        status={t("lumi.status")}
        description={t("lumi.description")}
        benefitsTitle={t("lumi.benefitsTitle")}
        benefits={lumiBenefits}
        detailsLink={t("lumi.detailsLink")}
        note={t("lumi.note")}
        visualLabel={t("lumi.visualLabel")}
        shaderLabels={shaderLabels}
        icon={Code2}
      />

      <AgentSection
        id="kairo"
        agent="kairo"
        index={t("kairo.index")}
        name="Kairo"
        role={t("kairo.role")}
        status={t("kairo.status")}
        description={t("kairo.description")}
        benefitsTitle={t("kairo.benefitsTitle")}
        benefits={kairoBenefits}
        detailsLink={t("kairo.detailsLink")}
        note={t("kairo.note")}
        visualLabel={t("kairo.visualLabel")}
        shaderLabels={shaderLabels}
        icon={Scale}
        reverse
      />

      <section className="border-t border-border py-24 md:py-32">
        <div className="container">
          <div
            data-reveal=""
            className="flex flex-col justify-between gap-12 lg:flex-row lg:items-end lg:gap-20"
          >
            <div className="max-w-2xl">
              <PenTool aria-hidden="true" className="size-7 text-foreground/70" strokeWidth={1.5} />
              <h2 className="mt-8 text-3xl font-medium tracking-tight sm:text-4xl">{t("designBridge.title")}</h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">{t("designBridge.description")}</p>
            </div>
            <Button size="lg" asChild className="w-fit shrink-0">
              <Link href="/services" className="group">
                {t("designBridge.cta")}
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
