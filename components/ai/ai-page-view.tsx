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
  processTitle: string;
  steps: string[];
  note: string;
  visualLabel: string;
  shaderLabels: {
    play: string;
    pause: string;
    resume: string;
    replay: string;
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
  processTitle,
  steps,
  note,
  visualLabel,
  shaderLabels,
  icon: Icon,
  reverse = false,
}: AgentSectionProps) {
  return (
    <section id={id} className="border-t border-border py-20 md:py-28">
      <div className="container grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <figure
          data-reveal=""
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-card",
            reverse && "lg:order-2"
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 text-xs sm:px-6">
            <span className="font-medium tracking-[0.16em] text-muted-foreground uppercase">{index}</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary">
              {status}
            </span>
          </div>
          <div className="aspect-[8/5] w-full bg-background text-foreground">
            <AgentShaderPlayer agent={agent} labels={shaderLabels} />
          </div>
          <figcaption className="sr-only">{visualLabel}</figcaption>
        </figure>

        <div data-reveal="" data-reveal-delay={100} className="min-w-0">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />
          </div>
          <p className="mt-6 text-sm font-medium text-primary">{role}</p>
          <h2 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">{name}</h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>

          <h3 className="mt-8 text-sm font-semibold text-foreground">{processTitle}</h3>
          <ol className="mt-4 space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/5 font-mono text-xs text-primary"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 text-sm leading-relaxed text-foreground/85 sm:text-base">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-7 max-w-xl border-l-2 border-primary/50 pl-4 text-sm leading-relaxed text-muted-foreground">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}

export async function AiPageView() {
  const t = await getRequestTranslations("ai");
  const lumiSteps = t.raw("lumi.steps") as string[];
  const kairoSteps = t.raw("kairo.steps") as string[];
  const shaderLabels = {
    play: t("animation.play"),
    pause: t("animation.pause"),
    resume: t("animation.resume"),
    replay: t("animation.replay"),
  };

  return (
    <>
      <section className="relative overflow-hidden bg-background pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{t("eyebrow")}</p>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {t("announcement")}
                </span>
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                {t("title")}
              </h1>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:justify-self-end">
              {t("intro")}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <a href="#lumi-q1">Lumi Q1</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#kairo">Kairo</a>
            </Button>
          </div>

          <aside
            data-reveal=""
            className="mt-12 flex max-w-4xl items-start gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
            aria-label={t("integrationNoticeTitle")}
          >
            <CircuitBoard aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.7} />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("integrationNoticeTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("integrationNotice")}</p>
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
        processTitle={t("lumi.processTitle")}
        steps={lumiSteps}
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
        processTitle={t("kairo.processTitle")}
        steps={kairoSteps}
        note={t("kairo.note")}
        visualLabel={t("kairo.visualLabel")}
        shaderLabels={shaderLabels}
        icon={Scale}
        reverse
      />

      <section className="border-t border-border py-20 md:py-24">
        <div className="container">
          <div
            data-reveal=""
            className="flex flex-col justify-between gap-8 rounded-2xl border border-border bg-card p-6 sm:p-10 lg:flex-row lg:items-center"
          >
            <div className="max-w-2xl">
              <PenTool aria-hidden="true" className="size-5 text-primary" strokeWidth={1.7} />
              <h2 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">{t("designBridge.title")}</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("designBridge.description")}</p>
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
