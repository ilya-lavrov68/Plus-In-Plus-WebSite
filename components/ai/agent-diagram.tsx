import { cn } from "@/lib/utils";

interface AgentDiagramProps {
  agent: "lumi" | "kairo";
  className?: string;
}

const GRID_CELLS = Array.from({ length: 120 }, (_, index) => index);

/**
 * Статичный кадр схемы агента. Он же остаётся доступным fallback для
 * reduced motion и для устройств без WebGL после подключения shader-слоя.
 */
export function AgentDiagram({ agent, className }: AgentDiagramProps) {
  const activeNode = agent === "lumi" ? 1 : 2;
  const nodes = [0, 1, 2];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 640 400"
      className={cn("size-full", className)}
    >
      <g fill="currentColor" className="text-foreground/[0.08]">
        {GRID_CELLS.map((index) => (
          <rect
            key={index}
            x={(index % 15) * 42 + 10}
            y={Math.floor(index / 15) * 48 + 12}
            width="3"
            height="3"
          />
        ))}
      </g>

      <path
        d="M144 200H256M384 200H496"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 10"
        className="text-primary/40"
      />

      {nodes.map((node) => {
        const x = 64 + node * 216;
        const active = node === activeNode;
        return (
          <g key={node} transform={`translate(${x} 144)`}>
            <rect
              width="112"
              height="112"
              rx="18"
              fill={active ? "currentColor" : "transparent"}
              fillOpacity={active ? 0.1 : 0}
              stroke="currentColor"
              strokeWidth="2"
              className={active ? "text-primary" : "text-foreground/20"}
            />
            <rect
              x="18"
              y="18"
              width="12"
              height="12"
              fill="currentColor"
              className={active ? "text-primary" : "text-foreground/25"}
            />
            <rect
              x="82"
              y="82"
              width="12"
              height="12"
              fill="currentColor"
              className={active ? "text-primary" : "text-foreground/25"}
            />
            <text
              x="56"
              y="65"
              textAnchor="middle"
              fill="currentColor"
              fontSize="20"
              fontFamily="ui-monospace, monospace"
              className={active ? "text-primary" : "text-foreground/65"}
            >
              0{node + 1}
            </text>
          </g>
        );
      })}

      <g fill="currentColor" className="text-primary/70">
        <rect x="308" y="82" width="8" height="8" />
        <rect x="324" y="66" width="8" height="8" />
        <rect x="308" y="310" width="8" height="8" />
        <rect x="324" y="326" width="8" height="8" />
      </g>
    </svg>
  );
}
