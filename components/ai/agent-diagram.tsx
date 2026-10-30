import { cn } from "@/lib/utils";

interface AgentDiagramProps {
  agent: "lumi" | "kairo";
  enhanced?: boolean;
  className?: string;
}

interface StaticBar {
  x: number;
  y: number;
  width: number;
  fill: string;
  opacity: number;
  spark: boolean;
}

const TAU = 6.2831853;
const CYCLE = 4.2;
const fract = (value: number) => value - Math.floor(value);
const hash = (x: number, y: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const blob = (x: number, y: number, cx: number, cy: number, radius: number, strength: number) => {
  const dx = x - cx;
  const dy = y - cy;
  return strength * Math.exp(-(dx * dx + dy * dy) / (radius * radius));
};
const sm = (a: number, b: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** JS-сэмплер оригинального field только для неподвижного финального SVG-кадра. */
function streamingField(x: number, y: number, t: number) {
  const phase = (TAU * t) / CYCLE;
  let value = blob(x, y, 88, 230, 30, 1.05);

  if (x > 116 && x < 356) {
    const envelope = Math.sin((Math.PI * (x - 116)) / 240);
    const waveY = 230 + 30 * envelope * Math.sin(x * 0.035 - phase * 2);
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(x * 0.08 - phase * 6), 4);
    value += Math.exp(-Math.pow(y - waveY, 2) / 64) * (0.3 + 0.75 * pulse);
  }

  if (x > 376 && x < 654 && y > 130 && y < 322) {
    const yy = y + 46 * sm(3.2, 3.8, t);
    const index = Math.floor((yy - 160 + 23) / 46);
    const lineY = 160 + 46 * index;
    const on = hash(Math.floor(x / 7), 1) >= 0.32 ? 1 : 0;
    const front = t < 0.3 ? 380 : t < 3 ? 380 + ((650 - 380) * (t - 0.3)) / 2.7 : 650;
    const filled =
      index < 3 ? 1 : index < 4 ? (t > 3 ? 1 : 1 - sm(front - 6, front + 4, x)) : 0;
    const band = Math.exp(-Math.pow(yy - lineY, 2) / 49);
    value +=
      band *
      (on * (0.55 + 0.35 * hash(Math.floor(x / 7), 2)) * filled +
        0.13 * (1 - filled) * on);
    const cursorX = t < 3 ? front : 380;
    const cursorY = t < 3 ? 298 : 298 - 46 * sm(3.2, 3.8, t) + 46 * (t >= 3.8 ? 1 : 0);
    value += blob(x, y, cursorX + 3, cursorY, 8, 1.2 * (t < 3 || t > 3.8 ? 1 : 0));
  }

  return value;
}

function createStaticBars() {
  const bars: StaticBar[] = [];
  for (let cell = 0; cell < 49; cell += 1) {
    for (let col = 0; col < 103; col += 1) {
      const value =
        streamingField(4 + col * 7, cell * 9.4 + 3.5, CYCLE) *
        (0.7 + 0.3 * hash(col, cell));
      let width = 0;
      let fill = "#6b6b00";
      let opacity = 1;
      if (value >= 0.72) {
        width = 3.6;
        fill = "#FFFF01";
      } else if (value >= 0.48) {
        width = 2.7;
        fill = "#d9d900";
      } else if (value >= 0.27) {
        width = 1.8;
        fill = "#9e9e00";
      } else if (value >= 0.1) {
        width = 1.1;
        opacity = 0.55;
      }
      if (!width) continue;
      bars.push({
        x: 4 + col * 7 - width / 2,
        y: cell * 9.4,
        width,
        fill,
        opacity,
        spark: width > 3.5 && hash(col, cell * 1.3) > 0.55,
      });
    }
  }
  return bars;
}

const STATIC_BARS = createStaticBars();
const GRID_PATH = [
  ...[0, 96, 192, 288, 384, 480, 576, 672].map((x) => `M${x} 0V460`),
  ...[0, 96, 192, 288, 384].map((y) => `M0 ${y}H720`),
].join("");
const CORNERS = [
  [58, 200],
  [118, 200],
  [58, 260],
  [118, 260],
  [360, 116],
  [672, 116],
  [360, 338],
  [672, 338],
];

/** MODEL → RESPONSE: общий overlay и финальный кадр для reduced motion/no WebGL. */
export function AgentDiagram({ agent, enhanced = false, className }: AgentDiagramProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-agent={agent}
      viewBox="0 0 720 460"
      className={cn("size-full", className)}
    >
      {!enhanced ? (
        <g data-static-field="">
          <path d={GRID_PATH} fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground/[0.06]" />
          {STATIC_BARS.map((bar) => (
            <g key={`${bar.x}:${bar.y}`}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height="7"
                fill={bar.fill}
                opacity={bar.opacity}
              />
              {bar.spark ? (
                <rect x={bar.x + bar.width / 2 - 0.35} y={bar.y + 2.2} width="0.7" height="1.6" fill="#fff" opacity="0.85" />
              ) : null}
            </g>
          ))}
        </g>
      ) : null}

      <g fill="none" stroke="#FFFF01" strokeOpacity="0.68" strokeWidth="1.2">
        <rect x="58" y="200" width="60" height="60" />
        <rect x="360" y="116" width="312" height="222" />
      </g>
      <g fill="#FFFF01">
        <rect x="58" y="200" width="34" height="12" />
        <rect x="360" y="116" width="72" height="14" />
        {CORNERS.map(([x, y]) => (
          <rect key={`${x}:${y}`} x={x - 1} y={y - 1} width="2" height="2" />
        ))}
      </g>
      <g fill="#0a0a0a" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight="700">
        <text x="61" y="208.5" fontSize="7">MODEL</text>
        <text x="364" y="125.5" fontSize="8">RESPONSE</text>
      </g>
    </svg>
  );
}
