import { AGENT_SHADER_SCENE_NAMES, type AgentKind, type AgentScene } from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

interface AgentDiagramProps {
  agent: AgentKind;
  scene?: AgentScene;
  enhanced?: boolean;
  className?: string;
}

/** Exact poster of the same shader loop for reduced motion, loading and no video. */
export function AgentDiagram({ agent, scene, enhanced = false, className }: AgentDiagramProps) {
  const resolvedScene = scene ?? agent;
  if (enhanced) return null;
  return (
    <img
      aria-hidden="true"
      alt=""
      data-agent={agent}
      data-scene={AGENT_SHADER_SCENE_NAMES[resolvedScene]}
      data-static-field={resolvedScene}
      src={`/assets/agents/${resolvedScene}-poster.webp`}
      width="720"
      height="460"
      loading="lazy"
      decoding="async"
      className={cn("size-full object-fill", className)}
    />
  );
}
