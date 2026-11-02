import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Детерминированная геометрия бренда.
 *
 * Источник языка форм — референс редизайна: ступенчатая пиксельная мозаика из
 * квадратов, полудроп-решётка окружностей и крупная техническая сетка.
 *
 * Роли цветов: жёлтый — главный сигнал бренда, пурпур из референса — вторичный.
 * Поэтому крупные сетки и мозаика по умолчанию пурпурные, а жёлтые клетки
 * работают как редкие сигнальные акценты (`tone="mixed"`).
 *
 * Всё строится чистым math-хешем без Math.random: серверный и клиентский рендер
 * совпадают, кадры стабильны между сборками, а тесты могут проверять структуру.
 * Это декоративный слой: он всегда aria-hidden, pointer-events-none и не несёт
 * смысла, который терялся бы без него.
 */

type OrnamentTone = "violet" | "signal" | "mixed";

const VIOLET_TINTS = [
  "var(--pip-violet)",
  "var(--pip-violet-strong)",
  "var(--pip-violet-wash)",
  "var(--pip-violet-deep)",
] as const;

const SIGNAL_TINTS = [
  "var(--pip-signal)",
  "var(--pip-signal-strong)",
  "var(--pip-signal-wash)",
  "var(--pip-signal-deep)",
] as const;

const LATTICE_NEUTRAL = "hsl(var(--muted-foreground) / 0.55)";

/** 32-битный хеш без состояния: одинаковые координаты дают одинаковый кадр. */
function hash2d(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 0x1f123bb5, 0x27d4eb2d) ^ Math.imul(y + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= Math.imul(seed + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function pixelTint(value: number, tone: OrnamentTone): string {
  const palette = tone === "signal" ? SIGNAL_TINTS : VIOLET_TINTS;
  if (value < 0.52) return palette[0];
  if (value < 0.72) return palette[1];
  if (value < 0.9) return palette[2];
  return palette[3];
}

function latticeTint(value: number, tone: OrnamentTone): string {
  if (tone === "signal") {
    if (value < 0.44) return SIGNAL_TINTS[0];
    if (value < 0.66) return SIGNAL_TINTS[1];
    if (value < 0.82) return SIGNAL_TINTS[2];
    return LATTICE_NEUTRAL;
  }
  if (value < 0.44) return VIOLET_TINTS[0];
  if (value < 0.66) return VIOLET_TINTS[1];
  if (value < 0.82) return VIOLET_TINTS[2];
  return LATTICE_NEUTRAL;
}

export interface OrnamentProps {
  className?: string;
  /** Число ячеек по горизонтали. */
  cols?: number;
  /** Число ячеек по вертикали. */
  rows?: number;
  /** Сдвиг рисунка: одинаковый seed даёт одинаковый орнамент. */
  seed?: number;
  /** Угол, в котором рисунок набирает плотность. */
  corner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Пурпур (референс), жёлтый (главный сигнал) или микс. */
  tone?: OrnamentTone;
}

function cornerWeights(corner: OrnamentProps["corner"]) {
  return {
    flipX: corner === "bottom-right" || corner === "top-right",
    flipY: corner === "top-left" || corner === "top-right",
  };
}

/**
 * Пиксельная мозаика: ступенчатая масса квадратов, которая набирает плотность
 * к выбранному углу. Каждая ячейка — один острый квадрат без скругления.
 */
export function PixelMosaic({
  className,
  cols = 20,
  rows = 18,
  seed = 11,
  corner = "bottom-left",
  tone = "violet",
}: OrnamentProps) {
  const { flipX, flipY } = cornerWeights(corner);
  const cells: Array<{ x: number; y: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const nx = flipX ? 1 - x / cols : x / cols;
      const ny = flipY ? y / rows : 1 - y / rows;
      const depth = nx + ny;
      const noise = hash2d(x, y, seed);
      const inside = depth > 1.02 - noise * 0.22;
      const speck = !inside && noise > 0.965;

      if (!inside && !speck) continue;
      const tintValue = hash2d(x + 41, y + 97, seed);
      cells.push({
        x,
        y,
        // В миксе редкая яркая сигнальная клетка ставит жёлтый акцент в пурпур.
        fill:
          tone === "mixed" && tintValue > 0.93
            ? SIGNAL_TINTS[0]
            : pixelTint(tintValue, tone === "mixed" ? "violet" : tone),
        key: `${x}-${y}`,
      });
    }
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio={`${flipX ? "xMax" : "xMin"}${flipY ? "YMin" : "YMax"} slice`}
      shapeRendering="crispEdges"
      className={cn("pointer-events-none select-none", className)}
    >
      {cells.map((cell) => (
        <rect
          key={cell.key}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill={cell.fill}
        />
      ))}
    </svg>
  );
}

/**
 * Полудроп-решётка: окружности в шахматном смещении, плотность растёт к углу.
 * Круги — вторая половина геометрического контраста бренда: острое рядом с
 * круглым, но исключительно в декоративном слое.
 */
export function DotLattice({
  className,
  cols = 22,
  rows = 18,
  seed = 23,
  corner = "bottom-right",
  tone = "violet",
}: OrnamentProps) {
  const { flipX, flipY } = cornerWeights(corner);
  const dots: Array<{ cx: number; cy: number; r: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const offset = y % 2 === 0 ? 0.5 : 0;
      const baseX = x + 0.5 + offset;
      const cx = flipX ? cols + 0.5 - baseX : baseX;
      const cy = flipY ? rows - (y + 0.5) : y + 0.5;
      const nx = flipX ? 1 - baseX / cols : baseX / cols;
      const ny = flipY ? 1 - cy / rows : cy / rows;
      const depth = nx + ny;
      const noise = hash2d(x, y, seed);
      const inside = depth > 0.98 - noise * 0.3;
      const speck = !inside && noise > 0.94;

      if (!inside && !speck) continue;
      const tintValue = hash2d(x + 13, y + 29, seed);
      dots.push({
        cx,
        cy,
        r: 0.3 + noise * 0.16,
        fill:
          tone === "mixed" && tintValue > 0.95
            ? SIGNAL_TINTS[0]
            : latticeTint(tintValue, tone === "mixed" ? "violet" : tone),
        key: `${x}-${y}`,
      });
    }
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${cols + 0.5} ${rows}`}
      preserveAspectRatio={`${flipX ? "xMax" : "xMin"}${flipY ? "YMin" : "YMax"} slice`}
      className={cn("pointer-events-none select-none", className)}
    >
      {dots.map((dot) => (
        <circle key={dot.key} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} />
      ))}
    </svg>
  );
}

export interface GridFieldProps {
  className?: string;
  /** Количество колонок виртуальной сетки. */
  cols?: number;
  /** Количество строк виртуальной сетки. */
  rows?: number;
  /** Сколько крупных клеток залить цветом. */
  blocks?: number;
  seed?: number;
  tone?: OrnamentTone;
  /** Рисовать только линии, без залитых клеток. */
  linesOnly?: boolean;
}

/**
 * Крупная техническая сетка: линии масштабируются вместе с контейнером, а часть
 * клеток детерминированно залита цветом. Пропорции держатся на процентах, поэтому
 * линии и заливки остаются выровненными на любом экране.
 *
 * Используется полосами и боковыми полями рядом с контентом, а не под текстом:
 * воздух и читаемость важнее декоративного заполнения.
 */
export function GridField({
  className,
  cols = 12,
  rows = 8,
  blocks = 5,
  seed = 5,
  tone = "violet",
  linesOnly = false,
}: GridFieldProps) {
  const palette =
    tone === "signal" ? SIGNAL_TINTS : tone === "mixed" ? [...VIOLET_TINTS, ...SIGNAL_TINTS] : VIOLET_TINTS;
  const cells: Array<{ key: string; style: CSSProperties }> = [];

  if (!linesOnly) {
    for (let index = 0; index < blocks; index += 1) {
      const noiseX = hash2d(index, 3, seed);
      const noiseY = hash2d(index, 7, seed);
      const noiseW = hash2d(index, 11, seed);
      const noiseTone = hash2d(index, 17, seed);
      const col = Math.min(cols - 1, Math.floor(noiseX * cols));
      const row = Math.min(rows - 1, Math.floor(noiseY * rows));
      const width = noiseW > 0.72 ? 2 : 1;
      const fill =
        tone === "mixed"
          ? noiseTone > 0.7
            ? SIGNAL_TINTS[0]
            : VIOLET_TINTS[noiseTone > 0.35 ? 0 : 1]
          : palette[noiseTone > 0.55 ? 0 : 1];

      cells.push({
        key: `block-${index}`,
        style: {
          left: `${(col * 100) / cols}%`,
          top: `${(row * 100) / rows}%`,
          width: `${(Math.min(width, cols - col) * 100) / cols}%`,
          height: `${100 / rows}%`,
          backgroundColor: fill,
        },
      });
    }
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pip-tech-grid pointer-events-none select-none overflow-hidden",
        className
      )}
      style={{ backgroundSize: `${100 / cols}% ${100 / rows}%` }}
    >
      {cells.map((cell) => (
        <span
          key={cell.key}
          className="absolute block"
          style={{ ...cell.style, opacity: 0.62 }}
        />
      ))}
    </div>
  );
}

/**
 * Горизонтальная сигнальная линейка: короткий ряд острых блоков, который
 * заменяет декоративные тени и градиентные разделители.
 */
export function SignalBlocks({
  className,
  count = 5,
  tone = "signal",
}: {
  className?: string;
  count?: number;
  tone?: "signal" | "violet";
}) {
  const active = tone === "signal" ? "var(--pip-signal)" : "var(--pip-violet)";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none flex select-none items-center gap-1", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="block size-1.5"
          style={{
            backgroundColor: index === count - 1 ? active : "hsl(var(--border))",
          }}
        />
      ))}
    </div>
  );
}
