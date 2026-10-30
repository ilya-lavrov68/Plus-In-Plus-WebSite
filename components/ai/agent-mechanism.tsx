"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type AgentMechanismKind =
  | "permissions"
  | "sandbox"
  | "runtime"
  | "graph"
  | "verification"
  | "brief";

type AgentMechanismProps = {
  kind: AgentMechanismKind;
  description: string;
  labels: string[];
};

type MotionStyle = CSSProperties & { "--agent-travel"?: string };

const stroke = { stroke: "currentColor", strokeWidth: 1 } as const;
const motionX = (delay: string, travel = "240px"): MotionStyle => ({
  animationDelay: delay,
  "--agent-travel": travel,
});

/**
 * Конечные поясняющие схемы: один переход при появлении, без ambient-loop.
 * Без JS и при reduced motion остаётся полная статичная композиция.
 */
export function AgentMechanism({ kind, description, labels }: AgentMechanismProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let visible = false;
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.35 }
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-agent-mechanism={kind}
      data-active={active}
      data-motion="finite"
      className="border-t border-border pt-6 text-foreground"
    >
      <div className="aspect-[640/300] w-full">
        <svg aria-hidden="true" viewBox="0 0 640 300" className="size-full overflow-visible">
          {kind === "permissions" ? <PermissionsScene labels={labels} /> : null}
          {kind === "sandbox" ? <SandboxScene labels={labels} /> : null}
          {kind === "runtime" ? <RuntimeScene labels={labels} /> : null}
          {kind === "graph" ? <GraphScene labels={labels} /> : null}
          {kind === "verification" ? <VerificationScene labels={labels} /> : null}
          {kind === "brief" ? <BriefScene labels={labels} /> : null}
        </svg>
      </div>
      <p className="sr-only">{description}</p>
    </div>
  );
}

function SceneText({ x, y, children, accent = false }: { x: number; y: number; children: string; accent?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      fontSize="12"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      letterSpacing="1.1"
      className={accent ? "text-primary" : "text-muted-foreground"}
    >
      {children}
    </text>
  );
}

function PermissionsScene({ labels }: { labels: string[] }) {
  const [context, policy, action, levels, read, approval] = labels;
  return (
    <g>
      <SceneText x={36} y={42}>{context}</SceneText>
      <SceneText x={268} y={42}>{policy}</SceneText>
      <SceneText x={456} y={42}>{action}</SceneText>
      <SceneText x={268} y={74} accent>{levels}</SceneText>
      <g {...stroke} className="text-foreground/20">
        <path d="M36 105H196M36 137H172M36 169H186" />
        <path d="M320 96V226M312 104H328M312 214H328" />
        <path d="M456 105H588M456 169H572" />
        <path d="M196 137H300" strokeDasharray="3 7" />
        <path d="M340 137H456" strokeDasharray="3 7" />
      </g>
      <SceneText x={36} y={211}>{read}</SceneText>
      <SceneText x={456} y={211}>{approval}</SceneText>
      <text x={36} y={119} fill="currentColor" fontSize="13" fontFamily="ui-monospace, monospace">read_file</text>
      <text x={36} y={151} fill="currentColor" fontSize="13" fontFamily="ui-monospace, monospace">search</text>
      <text x={456} y={119} fill="currentColor" fontSize="13" fontFamily="ui-monospace, monospace">write_file</text>
      <text x={456} y={183} fill="currentColor" fontSize="13" fontFamily="ui-monospace, monospace">run_command</text>
      <g className="agent-motion agent-motion-x agent-motion-signal" style={motionX("0.2s", "128px")}>
        <circle cx={188} cy={137} r={4} fill="#FFFF01" />
      </g>
      <path
        d="M344 137H440"
        {...stroke}
        className="agent-motion agent-motion-draw text-primary"
        style={{ animationDelay: "1.4s" }}
      />
      <g className="agent-motion agent-motion-fade" style={{ animationDelay: "2.1s" }}>
        <path d="M301 126L320 137L301 148" {...stroke} className="text-primary" />
      </g>
    </g>
  );
}

function SandboxScene({ labels }: { labels: string[] }) {
  const [main, copy, branch, publish, discard, wipe] = labels;
  return (
    <g>
      <SceneText x={34} y={48}>{main}</SceneText>
      <SceneText x={202} y={126}>{copy}</SceneText>
      <SceneText x={202} y={190} accent>{branch}</SceneText>
      <SceneText x={466} y={100}>{publish}</SceneText>
      <SceneText x={466} y={226}>{discard}</SceneText>
      <g {...stroke} className="text-foreground/20">
        <path d="M34 78H560" />
        <path d="M134 78C134 150 202 160 276 160H506" />
        <path d="M506 160C550 160 552 112 586 112" />
        <path d="M506 160C550 160 552 212 586 212" />
      </g>
      <g fill="currentColor" className="text-foreground/45">
        <rect x={130} y={74} width={8} height={8} />
        <rect x={554} y={74} width={8} height={8} />
      </g>
      <g className="agent-motion agent-motion-draw" style={{ animationDelay: "0.3s" }}>
        <path d="M144 84C154 140 210 150 276 150H500" {...stroke} className="text-primary" />
      </g>
      <g className="agent-motion agent-motion-x agent-motion-signal" style={motionX("1s", "230px")}>
        <rect x={244} y={146} width={8} height={8} fill="#FFFF01" />
      </g>
      <g className="agent-motion agent-motion-fade" style={{ animationDelay: "2.4s" }}>
        <path d="M578 104L586 112L578 120M578 204L586 212L578 220" {...stroke} className="text-primary" />
      </g>
      <SceneText x={202} y={260}>{wipe}</SceneText>
      <path d="M202 274H560" {...stroke} className="agent-motion agent-motion-draw text-foreground/35" style={{ animationDelay: "3s" }} />
    </g>
  );
}

function RuntimeScene({ labels }: { labels: string[] }) {
  const [model, local, vps, cloud, status, order] = labels;
  return (
    <g>
      <SceneText x={34} y={42}>{model}</SceneText>
      <SceneText x={34} y={78} accent>{order}</SceneText>
      <SceneText x={176} y={112}>{local}</SceneText>
      <SceneText x={336} y={112}>{vps}</SceneText>
      <SceneText x={496} y={112}>{cloud}</SceneText>
      <g {...stroke} className="text-foreground/20">
        <path d="M34 154H584" />
        <path d="M176 134V174M336 134V174M496 134V174" />
        <path d="M176 206H496" strokeDasharray="3 7" />
      </g>
      {[176, 336, 496].map((x, index) => (
        <g key={x} className="agent-motion agent-motion-fade" style={{ animationDelay: `${0.5 + index * 0.8}s` }}>
          <rect x={x - 4} y={150} width={8} height={8} fill="#FFFF01" />
          <path d={`M${x - 30} 190H${x + 30}`} {...stroke} className="text-primary" />
        </g>
      ))}
      <SceneText x={176} y={242}>{status}</SceneText>
      <path d="M176 258H496" {...stroke} className="agent-motion agent-motion-draw text-foreground/35" style={{ animationDelay: "3s" }} />
    </g>
  );
}

function GraphScene({ labels }: { labels: string[] }) {
  const [facts, plan, rag, calculation, verification, answer] = labels;
  const nodes = [
    { x: 42, label: facts },
    { x: 142, label: plan },
    { x: 242, label: rag },
    { x: 342, label: calculation },
    { x: 442, label: verification },
    { x: 542, label: answer },
  ];
  return (
    <g>
      <path d="M42 142H584" {...stroke} className="text-foreground/20" />
      <path d="M42 142H584" {...stroke} className="agent-motion agent-motion-draw text-primary" style={{ animationDelay: "0.2s" }} />
      {nodes.map((node, index) => (
        <g key={node.label}>
          <g className="agent-motion agent-motion-fade" style={{ animationDelay: `${0.35 + index * 0.55}s` }}>
            <rect x={node.x} y={138} width={8} height={8} fill={index === nodes.length - 1 ? "#FFFF01" : "currentColor"} />
          </g>
          <SceneText x={node.x - 10} y={index % 2 === 0 ? 112 : 190}>{node.label}</SceneText>
          <path d={`M${node.x + 4} 150V${index % 2 === 0 ? 122 : 174}`} {...stroke} className="text-foreground/20" />
        </g>
      ))}
      <path d="M42 232H584" {...stroke} className="text-foreground/15" strokeDasharray="2 8" />
      <path d="M42 232H584" {...stroke} className="agent-motion agent-motion-draw text-foreground/40" style={{ animationDelay: "3.5s" }} />
    </g>
  );
}

function VerificationScene({ labels }: { labels: string[] }) {
  const [sources, model, code, citations, amounts, formulas] = labels;
  return (
    <g>
      <SceneText x={34} y={42}>{sources}</SceneText>
      <SceneText x={252} y={42}>{model}</SceneText>
      <SceneText x={452} y={42}>{code}</SceneText>
      <g {...stroke} className="text-foreground/20">
        <path d="M34 78H178M34 110H158M34 142H170" />
        <path d="M214 190H586" />
        <path d="M252 78V148M452 78V148" strokeDasharray="3 7" />
      </g>
      {[citations, amounts, formulas].map((label, index) => {
        const y = 100 + index * 58;
        return (
          <g key={label}>
            <SceneText x={300} y={y + 4}>{label}</SceneText>
            <path d={`M300 ${y + 20}H540`} {...stroke} className="text-foreground/15" />
            <path
              d={`M548 ${y - 4}L556 ${y + 4}L572 ${y - 14}`}
              {...stroke}
              className="agent-motion agent-motion-draw text-primary"
              style={{ animationDelay: `${0.7 + index * 0.75}s` }}
            />
          </g>
        );
      })}
      <path d="M178 110H236" {...stroke} className="agent-motion agent-motion-draw text-primary" style={{ animationDelay: "0.2s" }} />
      <path d="M268 110H436" {...stroke} className="agent-motion agent-motion-draw text-primary" style={{ animationDelay: "1.8s" }} />
    </g>
  );
}

function BriefScene({ labels }: { labels: string[] }) {
  const [details, artifacts, answer, short, steps, detail, questions] = labels;
  return (
    <g>
      <SceneText x={34} y={42}>{details}</SceneText>
      <SceneText x={34} y={72} accent>{artifacts}</SceneText>
      <SceneText x={400} y={42}>{answer}</SceneText>
      <g {...stroke} className="text-foreground/20">
        <path d="M34 104H264M34 132H238M34 160H254M34 188H224M34 216H246" />
        <path d="M304 150H366" strokeDasharray="3 7" />
        <path d="M400 110H586M400 160H554M400 210H574" />
      </g>
      <path d="M304 150H366" {...stroke} className="agent-motion agent-motion-draw text-primary" style={{ animationDelay: "0.4s" }} />
      {[0, 1, 2].map((index) => (
        <path
          key={index}
          d={`M400 ${110 + index * 50}H${index === 1 ? 554 : 586 - index * 12}`}
          {...stroke}
          className="agent-motion agent-motion-draw text-primary"
          style={{ animationDelay: `${0.9 + index * 0.65}s` }}
        />
      ))}
      <SceneText x={400} y={122}>{short}</SceneText>
      <SceneText x={400} y={172}>{steps}</SceneText>
      <SceneText x={400} y={222}>{detail}</SceneText>
      <SceneText x={34} y={262}>{questions}</SceneText>
    </g>
  );
}
