import Link from "next/link";
import { ArrowRight, CircuitBoard, Code2, PenTool, Scale, type LucideIcon } from "lucide-react";

import { AgentShaderPlayer } from "@/components/ai/agent-shader-player";
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
    <section id={id} style={{ borderTop: "1px solid var(--theme-border-color)", padding: "var(--block-spacing) 0" }}>
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)", rowGap: "3rem", alignItems: "center" }}>
        <figure
          data-reveal=""
          className={cn("min-w-0", reverse && "lg:order-2")}
        >
          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 text-xs">
            <span className="font-mono text-muted-foreground">{index}</span>
            <span className="font-medium text-muted-foreground">{status}</span>
          </div>
          <div className="mt-6 aspect-[36/23] w-full" style={{ borderTop: "1px solid var(--theme-border-color)", borderBottom: "1px solid var(--theme-border-color)", background: "var(--theme-bg)" }}>
            <AgentShaderPlayer key={agent} agent={agent} labels={shaderLabels} />
          </div>
          <figcaption className="sr-only">{visualLabel}</figcaption>
        </figure>

        <div data-reveal="" data-reveal-delay={100} className="min-w-0">
          <Icon aria-hidden="true" className="size-7 text-foreground/70" strokeWidth={1.5} />
          <p className="mt-8 text-sm font-medium text-foreground/80">{role}</p>
          <h2 className="pl-h2">{name}</h2>
          <p className="pl-body mt-7" style={{ maxWidth: "36rem" }}>
            {description}
          </p>

          <h3 className="pl-h6 mt-12">{benefitsTitle}</h3>
          <ol className="mt-6 space-y-6">
            {benefits.map((benefit, benefitIndex) => (
              <li key={benefit} style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem", borderTop: "1px solid var(--theme-border-color)", paddingTop: "1.25rem" }}>
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
      <section style={{ paddingBottom: "var(--block-spacing)" }}>
        <div style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20">
            <div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="pl-h6">{t("eyebrow")}</p>
                <span className="text-xs text-muted-foreground">{t("announcement")}</span>
              </div>
              <h1 className="pl-h1 mt-8">
                {t("title")}
              </h1>
            </div>
            <p className="pl-body">
              {t("intro")}
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link className="pl-btn" href="/ai/lumi" style={{ width: "auto" }}>
              Lumi Q1
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="pl-btn" href="/ai/kairo" style={{ width: "auto" }}>
              Kairo
              <span aria-hidden="true">→</span>
            </Link>
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

      <section style={{ borderTop: "1px solid var(--theme-border-color)", padding: "var(--block-spacing) 0" }}>
        <div style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
          <div
            data-reveal=""
            className="flex flex-col justify-between gap-12 lg:flex-row lg:items-end lg:gap-20"
          >
            <div className="max-w-2xl">
              <PenTool aria-hidden="true" className="size-7 text-foreground/70" strokeWidth={1.5} />
              <h2 className="pl-h2 mt-8">{t("designBridge.title")}</h2>
              <p className="pl-body mt-6">{t("designBridge.description")}</p>
            </div>
            <Link className="pl-btn" href="/services" style={{ width: "auto" }}>
              {t("designBridge.cta")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
