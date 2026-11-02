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

/** 32-битный хеш без состояния: одинаковые координаты дают одинаковый кадр. */
function hash2d(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 0x1f123bb5, 0x27d4eb2d) ^ Math.imul(y + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= Math.imul(seed + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/**
 * Профиль волны: высота массы в точке u (0 — у якорного края, 1 — на дальнем).
 * Две низкочастотные синусоиды рисуют плавный гребень, третья добавляет рябь.
 * Масса тает к дальнему краю, поэтому волна именно окутывает угол, а не
 * заливает половину экрана.
 */
function waveHeight(u: number, seed: number): number {
  const phase = (seed % 13) / 13;
  const envelope = Math.max(0, 1 - u * 0.55);
  const ripple =
    0.11 * Math.sin(u * Math.PI * 2.4 + phase * Math.PI * 2) +
    0.04 * Math.sin(u * Math.PI * 5.1 + phase * Math.PI * 3);
  return Math.max(0, Math.min(1, (0.58 + ripple) * envelope));
}

/** Координаты в системе якорного угла: u вдоль края, v от якорного края вверх. */
function cornerCoords(
  x: number,
  y: number,
  cols: number,
  rows: number,
  corner: OrnamentProps["corner"]
) {
  const xr = (x + 0.5) / cols;
  const yr = (y + 0.5) / rows;
  const anchorTop = corner === "top-left" || corner === "top-right";
  const anchorRight = corner === "top-right" || corner === "bottom-right";
  return {
    u: anchorRight ? 1 - xr : xr,
    v: anchorTop ? yr : 1 - yr,
  };
}

/** Тон клетки волны: светлые и глубокие оттенки, чистый сигнал — редко. */
function waveTint(value: number, tone: OrnamentTone): string {
  const accent = tone === "violet" ? VIOLET_TINTS : SIGNAL_TINTS;
  if (value > 0.96) return accent[0];
  if (value > 0.45) return accent[1];
  if (value > 0.15) return accent[2];
  return "hsl(var(--foreground) / 0.82)";
}

export interface OrnamentProps {
  className?: string;
  /** Число ячеек по горизонтали. */
  cols?: number;
  /** Число ячеек по вертикали. */
  rows?: number;
  /** Сдвиг рисунка: одинаковый seed даёт одинаковый орнамент. */
  seed?: number;
  /** Угол, из которого поднимается волна. */
  corner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Жёлтый сигнал (по умолчанию) или резервный пурпур. */
  tone?: OrnamentTone;
}

function cornerWeights(corner: OrnamentProps["corner"]) {
  return {
    flipX: corner === "bottom-right" || corner === "top-right",
    flipY: corner === "top-left" || corner === "top-right",
  };
}

/**
 * Пиксельная волна: масса квадратов с плавным ступенчатым гребнем, которая
 * поднимается из угла и окутывает край экрана. Над гребнем — редкие
 * отдельные пиксели, как брызги; они держат силуэт живым, но не шумным.
 */
export function PixelMosaic({
  className,
  cols = 20,
  rows = 18,
  seed = 11,
  corner = "bottom-left",
  tone = "signal",
}: OrnamentProps) {
  const { flipX, flipY } = cornerWeights(corner);
  const cells: Array<{ x: number; y: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const { u, v } = cornerCoords(x, y, cols, rows, corner);
      const height = waveHeight(u, seed);
      const noise = hash2d(x, y, seed);
      const edge = height + (noise - 0.5) * 0.02;
      const inside = v <= edge;
      const spray = !inside && v < height + 0.18 && noise > 0.895;

      if (!inside && !spray) continue;

      const tintValue = hash2d(x + 41, y + 97, seed);
      cells.push({
        x,
        y,
        fill:
          tone === "mixed" && tintValue > 0.94
            ? SIGNAL_TINTS[0]
            : waveTint(tintValue, tone === "mixed" ? "signal" : tone),
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

/** Тон точки: нейтральная основа, редкие жёлтые акценты. */
function waveDotTint(value: number, tone: OrnamentTone): string {
  const accent = tone === "violet" ? VIOLET_TINTS : SIGNAL_TINTS;
  if (value > 0.93) return accent[0];
  if (value > 0.55) return accent[1];
  if (value > 0.3) return accent[2];
  return "hsl(var(--foreground) / 0.85)";
}

/**
 * Решётка окружностей с той же волновой границей: полудроп-шаг, ровные
 * круги, плотность и размер растут к якорному углу. Круглое рядом с острым —
 * вторая половина геометрического контраста бренда.
 */
export function DotLattice({
  className,
  cols = 22,
  rows = 18,
  seed = 23,
  corner = "bottom-right",
  tone = "signal",
}: OrnamentProps) {
  const { flipX, flipY } = cornerWeights(corner);
  const dots: Array<{ cx: number; cy: number; r: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const offset = y % 2 === 0 ? 0.5 : 0;
      const cx = x + 0.5 + offset;
      const cy = y + 0.5;
      const { u, v } = cornerCoords(x, y, cols, rows, corner);
      const height = waveHeight(u, seed + 7);
      const noise = hash2d(x, y, seed);
      const inside = v <= height + (noise - 0.5) * 0.015;
      const spray = !inside && v < height + 0.1 && noise > 0.93;

      if (!inside && !spray) continue;

      const depth = Math.min(1, Math.max(0, (height - v) / Math.max(height, 0.001)));
      const tintValue = hash2d(x + 13, y + 29, seed);
      dots.push({
        cx,
        cy,
        r: 0.38 + depth * 0.05,
        fill:
          tone === "mixed" && tintValue > 0.95
            ? SIGNAL_TINTS[0]
            : waveDotTint(tintValue, tone === "mixed" ? "signal" : tone),
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
  tone = "signal",
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
