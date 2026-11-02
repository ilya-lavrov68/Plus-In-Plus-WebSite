import { cn } from "@/lib/utils";

/**
 * Детерминированные геометрические орнаменты бренда.
 *
 * Источник языка форм — референс редизайна: пиксельная мозаика в левом нижнем
 * углу (ступенчатая диагональ из квадратов четырёх сигнальных оттенков) и
 * полудроп-решётка окружностей в правом нижнем углу. Оба орнамента строятся
 * чистым math-хешем без Math.random, поэтому серверный и клиентский рендер
 * совпадают, а кадры стабильны между сборками.
 *
 * Это декоративный слой: он всегда aria-hidden, pointer-events-none и не несёт
 * смысла, который терялся бы без него.
 */

const PIXEL_TINTS = [
  "var(--pip-accent)",
  "var(--pip-accent-strong)",
  "var(--pip-accent-wash)",
  "var(--pip-accent-deep)",
] as const;

const LATTICE_TINTS = [
  "var(--pip-accent)",
  "var(--pip-accent-strong)",
  "var(--pip-accent-wash)",
  "hsl(var(--muted-foreground) / 0.55)",
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

function pixelTint(value: number): string {
  if (value < 0.52) return PIXEL_TINTS[0];
  if (value < 0.72) return PIXEL_TINTS[1];
  if (value < 0.9) return PIXEL_TINTS[2];
  return PIXEL_TINTS[3];
}

function latticeTint(value: number): string {
  if (value < 0.44) return LATTICE_TINTS[0];
  if (value < 0.66) return LATTICE_TINTS[1];
  if (value < 0.82) return LATTICE_TINTS[2];
  return LATTICE_TINTS[3];
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
  corner?: "bottom-left" | "bottom-right";
}

/**
 * Пиксельная мозаика: ступенчатая масса квадратов, которая набирает плотность
 * к выбранному углу. Каждая ячейка — один острый квадрат без скругления.
 */
export function PixelMosaic({
  className,
  cols = 16,
  rows = 16,
  seed = 11,
  corner = "bottom-left",
}: OrnamentProps) {
  const cells: Array<{ x: number; y: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const normalizedX = corner === "bottom-left" ? x / cols : 1 - x / cols;
      const normalizedY = 1 - y / rows;
      const depth = normalizedX + normalizedY;
      const noise = hash2d(x, y, seed);
      const inside = depth > 1.02 - noise * 0.22;
      const speck = !inside && noise > 0.965;

      if (!inside && !speck) continue;
      cells.push({
        x,
        y,
        fill: pixelTint(hash2d(x + 41, y + 97, seed)),
        key: `${x}-${y}`,
      });
    }
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMinYMax slice"
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
  cols = 18,
  rows = 18,
  seed = 23,
  corner = "bottom-right",
}: OrnamentProps) {
  const dots: Array<{ cx: number; cy: number; r: number; fill: string; key: string }> = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const offset = y % 2 === 0 ? 0.5 : 0;
      const cx = x + 0.5 + offset;
      const cy = y + 0.5;
      const normalizedX = corner === "bottom-right" ? cx / cols : 1 - cx / cols;
      const normalizedY = cy / rows;
      const depth = normalizedX + normalizedY;
      const noise = hash2d(x, y, seed);
      const inside = depth > 0.98 - noise * 0.3;
      const speck = !inside && noise > 0.94;

      if (!inside && !speck) continue;
      dots.push({
        cx,
        cy,
        r: 0.3 + noise * 0.16,
        fill: latticeTint(hash2d(x + 13, y + 29, seed)),
        key: `${x}-${y}`,
      });
    }
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${cols + 0.5} ${rows}`}
      preserveAspectRatio="xMaxYMax slice"
      className={cn("pointer-events-none select-none", className)}
    >
      {dots.map((dot) => (
        <circle key={dot.key} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} />
      ))}
    </svg>
  );
}

/**
 * Горизонтальная сигнальная линейка: короткий ряд острых блоков, который
 * заменяет декоративные тени и градиентные разделители.
 */
export function SignalBlocks({
  className,
  count = 5,
}: {
  className?: string;
  count?: number;
}) {
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
            backgroundColor:
              index === count - 1 ? "var(--pip-accent)" : "hsl(var(--border))",
          }}
        />
      ))}
    </div>
  );
}
