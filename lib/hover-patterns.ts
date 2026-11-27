import { decodeConfig, type GradientConfig } from "hazeglow";

import { payloadOf } from "@/lib/hazeglow-presets";

/**
 * Паттерны подсветки карточек при наведении.
 *
 * Правила владельца:
 * - паттерны присылает он сам, по ссылке на каждый, как и фоны секций;
 * - одна карточка — один паттерн, одинаковых на все карточки быть не должно;
 * - паттерны одноцветные: палитра сводится к одной оси, иначе подсветка
 *   спорит с брендовым оранжевым и превращается в радугу.
 *
 * Пока списка нет, подсветки нет вовсе: лучше пустая поверхность, чем
 * выдуманный агентом паттерн.
 */
export const HOVER_PATTERN_LINKS: string[] = [];

/** Оттенок, к которому сводится паттерн. Брендовый оранжевый — акцент. */
const ACCENT = "#ff5f01";

function hexToHsl(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

function hslCss(hue: number, saturation: number, lightness: number): string {
  return `hsl(${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(
    lightness * 100,
  )}%)`;
}

/**
 * Одноцветная шкала из одного оттенка: шесть ступеней по светлоте от почти
 * чёрного до акцента. Любой присланный паттерн приводится к ней, чтобы
 * подсветка оставалась однотонной.
 */
export function monochromePalette(source: string = ACCENT): string[] {
  const [hue, saturation] = hexToHsl(source);
  const sat = Math.max(0.45, Math.min(0.95, saturation));
  return [
    "#110f10",
    hslCss(hue, sat * 0.6, 0.09),
    hslCss(hue, sat * 0.75, 0.16),
    hslCss(hue, sat, 0.26),
    hslCss(hue, sat, 0.4),
    hslCss(hue, sat, 0.52),
  ];
}

/** Стабильный номер паттерна для ключа карточки: один ключ — один паттерн. */
export function patternIndexFor(key: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 100_000;
  }
  return hash % count;
}

/**
 * Конфиг подсветки для карточки. `null` — паттернов ещё нет либо ссылка битая:
 * тогда подсветка не рисуется совсем.
 */
export function hoverPatternFor(key: string): GradientConfig | null {
  if (HOVER_PATTERN_LINKS.length === 0) return null;
  const link =
    HOVER_PATTERN_LINKS[patternIndexFor(key, HOVER_PATTERN_LINKS.length)];
  const payload = payloadOf(link);
  if (!payload) return null;
  try {
    const decoded = decodeConfig(payload);
    return {
      ...decoded,
      // Одноцветность — правило проекта, а не пожелание: палитра сводится к
      // одной оси даже если в ссылке пришло несколько оттенков.
      palette: monochromePalette(decoded.palette?.[decoded.palette.length - 1] ?? ACCENT),
      background: "#110f10",
      // Статичный кадр: ни движения, ни перерисовки.
      motion: "none",
      speed: 0,
      loop: 0,
      hover: 0,
      mesh: [],
    };
  } catch {
    return null;
  }
}
