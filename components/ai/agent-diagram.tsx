import { AGENT_STATIC_BAR_FILLS, AGENT_STATIC_FRAMES } from "@/lib/agent-static-frames";
import type { AgentKind } from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

interface AgentDiagramProps {
  agent: AgentKind;
  enhanced?: boolean;
  className?: string;
}

const GRID_PATH = [
  ...[0, 96, 192, 288, 384, 480, 576, 672].map((x) => `M${x} 0V460`),
  ...[0, 96, 192, 288, 384].map((y) => `M0 ${y}H720`),
].join("");

/** Неподвижный кадр той же Tool calls/RAG field-сцены для reduced motion/no WebGL. */
export function AgentDiagram({ agent, enhanced = false, className }: AgentDiagramProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-agent={agent}
      data-scene={agent === "lumi" ? "tool-calls" : "rag-answer"}
      viewBox="0 0 720 460"
      className={cn("size-full", className)}
    >
      {!enhanced ? (
        <g data-static-field={agent}>
          <path d={GRID_PATH} fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground/[0.06]" />
          {AGENT_STATIC_FRAMES[agent].map(([x, y, width, fill, spark]) => (
            <g key={`${x}:${y}`}>
              <rect
                x={x}
                y={y}
                width={width}
                height="7"
                fill={AGENT_STATIC_BAR_FILLS[fill]}
                opacity={width === 1.1 ? 0.55 : 1}
              />
              {spark ? (
                <rect x={x + width / 2 - 0.35} y={y + 2.2} width="0.7" height="1.6" fill="#fff" opacity="0.85" />
              ) : null}
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
