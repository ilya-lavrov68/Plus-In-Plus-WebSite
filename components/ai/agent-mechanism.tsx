import { AgentShaderPlayer } from "@/components/ai/agent-shader-player";
import type { AgentKind, AgentScene } from "@/lib/agent-shaders";

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
  labels: {
    play: string;
    pause: string;
    resume: string;
  };
};

const MECHANISM_SCENES: Record<AgentMechanismKind, { agent: AgentKind; scene: AgentScene }> = {
  permissions: { agent: "lumi", scene: "lumi-permissions" },
  sandbox: { agent: "lumi", scene: "lumi-sandbox" },
  runtime: { agent: "lumi", scene: "lumi-runtime" },
  graph: { agent: "kairo", scene: "kairo-graph" },
  verification: { agent: "kairo", scene: "kairo-verification" },
  brief: { agent: "kairo", scene: "kairo-brief" },
};

/** Технологический процесс в том же двухпроходном Illos renderer, что и hero. */
export function AgentMechanism({ kind, description, labels }: AgentMechanismProps) {
  const { agent, scene } = MECHANISM_SCENES[kind];
  return (
    <figure data-agent-mechanism={kind} data-motion="shader" className="min-w-0 text-foreground">
      <div className="aspect-[36/23] w-full border-y border-border bg-background">
        <AgentShaderPlayer key={scene} agent={agent} scene={scene} labels={labels} />
      </div>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
