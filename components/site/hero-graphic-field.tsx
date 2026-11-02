const HERO_COLORS = {
  primary: "var(--hero-graphic-primary)",
  mid: "var(--hero-graphic-mid)",
  deep: "var(--hero-graphic-deep)",
  soft: "var(--hero-graphic-soft)",
  pale: "var(--hero-graphic-pale)",
  neutral: "hsl(var(--foreground))",
} as const;

type HeroColor = (typeof HERO_COLORS)[keyof typeof HERO_COLORS];

type GraphicCell = {
  x: number;
  y: number;
  color: HeroColor;
};

/** A stable coordinate hash: the same composition is rendered on every load. */
function coordinateNoise(x: number, y: number, salt: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function yellowFor(x: number, y: number, salt: number): HeroColor {
  const value = coordinateNoise(x, y, salt);
  if (value < 0.36) return HERO_COLORS.primary;
  if (value < 0.55) return HERO_COLORS.mid;
  if (value < 0.72) return HERO_COLORS.deep;
  if (value < 0.9) return HERO_COLORS.soft;
  return HERO_COLORS.pale;
}

function dotColorFor(x: number, y: number): HeroColor {
  const value = coordinateNoise(x, y, 12);
  if (value > 0.9) return HERO_COLORS.neutral;
  return yellowFor(x, y, 14);
}

function buildPixelCells(): GraphicCell[] {
  const cells: GraphicCell[] = [];
  const step = 22;

  for (let y = 0; y <= 540; y += step) {
    for (let x = 0; x <= 696; x += step) {
      const surface = 120 + x * 0.58 + Math.sin(x / 74) * 30;
      const distance = y - surface;
      const noise = coordinateNoise(x, y, 2);
      const detached =
        x <= 220 && distance < -22 && distance > -112 && noise > 0.94;
      const density = distance > 72 ? 0.97 : distance > 20 ? 0.82 : 0.6;
      const inMass = distance >= -22 && noise < density;

      if (detached || inMass) {
        cells.push({ x, y, color: yellowFor(x, y, 5) });
      }
    }
  }

  return cells;
}

function buildDotCells(): GraphicCell[] {
  const cells: GraphicCell[] = [];
  const step = 24;

  for (let y = 12; y <= 516; y += step) {
    for (let x = 12; x <= 756; x += step) {
      const surface = 482 - x * 0.45 + Math.sin(x / 72) * 32;
      const distance = y - surface;
      const noise = coordinateNoise(x, y, 8);
      const detached = distance < -12 && distance > -104 && noise > 0.955;
      const density = distance > 64 ? 0.96 : distance > 20 ? 0.8 : 0.56;
      const inWave = distance >= -12 && noise < density;

      if (detached || inWave) {
        cells.push({ x, y, color: dotColorFor(x, y) });
      }
    }
  }

  return cells;
}

const PIXEL_CELLS = buildPixelCells();
const DOT_CELLS = buildDotCells();

/**
 * Flat, asset-free hero artwork. Neither field moves or requests external media;
 * reduced-motion and no-JS sessions therefore receive the same complete scene.
 */
export function HeroGraphicField() {
  return (
    <>
      <div className="hero-reference__pixels" aria-hidden="true">
        <svg
          viewBox="0 0 720 560"
          className="block h-auto w-full"
          fill="none"
          focusable="false"
          shapeRendering="crispEdges"
          data-hero-graphic="pixels"
        >
          {PIXEL_CELLS.map((cell) => (
            <rect
              key={`pixel-${cell.x}-${cell.y}`}
              x={cell.x}
              y={cell.y}
              width="18"
              height="18"
              fill={cell.color}
            />
          ))}
        </svg>
      </div>

      <div className="hero-reference__dots" aria-hidden="true">
        <svg
          viewBox="0 0 768 528"
          className="block h-auto w-full"
          fill="none"
          focusable="false"
          data-hero-graphic="dots"
        >
          {DOT_CELLS.map((cell) => (
            <circle
              key={`dot-${cell.x}-${cell.y}`}
              cx={cell.x}
              cy={cell.y}
              r="6.5"
              fill={cell.color}
            />
          ))}
        </svg>
      </div>
    </>
  );
}
