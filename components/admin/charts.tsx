/**
 * Графики админки: чистый SVG без сторонних библиотек.
 *
 * Тени запрещены правилами PIP (docs/ui-ux-pro-max.md), поэтому глубина
 * строится hairline-сеткой и фоном. Каждый график имеет текстовое описание для
 * screen reader: значения не передаются только цветом или формой.
 */

export interface SeriesPoint {
  label: string;
  primary: number;
  secondary?: number;
}

const GRID_LINES = 4;

function ticks(max: number): number[] {
  return Array.from({ length: GRID_LINES + 1 }, (_, index) => Math.round((max / GRID_LINES) * index));
}

export function AreaChart({
  data,
  width = 720,
  height = 220,
  ariaLabel,
  primaryLabel,
  secondaryLabel,
}: {
  data: SeriesPoint[];
  width?: number;
  height?: number;
  ariaLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const pad = { top: 14, right: 10, bottom: 26, left: 10 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((point) => Math.max(point.primary, point.secondary ?? 0)));
  const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;
  const x = (index: number) => pad.left + (data.length > 1 ? index * step : innerWidth / 2);
  const y = (value: number) => pad.top + innerHeight - (value / max) * innerHeight;

  const line = (key: "primary" | "secondary") =>
    data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key] ?? 0).toFixed(1)}`).join(" ");

  const areaPath =
    data.length > 0
      ? `${line("primary")} L${x(data.length - 1).toFixed(1)},${pad.top + innerHeight} L${pad.left},${pad.top + innerHeight} Z`
      : "";

  const labelIndexes = data.length > 0 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];
  const total = data.reduce((sum, point) => sum + point.primary, 0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${ariaLabel}: ${primaryLabel} — ${total}`}
        preserveAspectRatio="none"
      >
        {ticks(max).map((value) => (
          <line
            key={value}
            x1={pad.left}
            x2={pad.left + innerWidth}
            y1={y(value)}
            y2={y(value)}
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeDasharray={value === 0 ? undefined : "2 6"}
          />
        ))}
        {areaPath ? <path d={areaPath} fill="var(--pip-signal)" fillOpacity="0.08" stroke="none" /> : null}
        <path d={line("primary")} fill="none" stroke="var(--pip-signal)" strokeWidth="2" strokeLinejoin="round" />
        {secondaryLabel ? (
          <path
            d={line("secondary")}
            fill="none"
            stroke="var(--pip-violet)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />
        ) : null}
        {labelIndexes.map((index) => (
          <text
            key={`${data[index]?.label ?? index}-${index}`}
            x={x(index)}
            y={height - 6}
            textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.6"
          >
            {data[index]?.label ?? ""}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-primary" />
          {primaryLabel}
        </span>
        {secondaryLabel ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-brand-violet" />
            {secondaryLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function BarList({
  items,
  emptyLabel,
  formatValue = (value) => String(value),
}: {
  items: { label: string; value: number }[];
  emptyLabel: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="truncate text-sm">{item.label}</span>
          <span className="text-sm tabular-nums text-on-surface-variant">{formatValue(item.value)}</span>
          <span aria-hidden="true" className="col-span-2 block h-1.5 w-full bg-surface-container-high">
            <span
              className="block h-full bg-primary"
              style={{ width: `${Math.max(2, Math.round((item.value / max) * 100))}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({
  data,
  height = 160,
  ariaLabel,
  formatValue = (value) => String(value),
}: {
  data: { label: string; value: number }[];
  height?: number;
  ariaLabel: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  if (data.length === 0) {
    return <p className="text-sm text-on-surface-variant">{ariaLabel}: 0</p>;
  }
  return (
    <div
      className="flex items-end gap-1"
      style={{ height }}
      role="img"
      aria-label={`${ariaLabel}: ${formatValue(total)}`}
    >
      {data.map((point) => (
        <span
          key={point.label}
          title={`${point.label}: ${formatValue(point.value)}`}
          className="flex-1 bg-primary/70 transition-colors hover:bg-primary"
          style={{ height: `${Math.max(2, Math.round((point.value / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}
