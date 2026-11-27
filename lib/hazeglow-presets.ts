import { decodeConfig, type GradientConfig } from "hazeglow";

/**
 * Градиенты, которые владелец собирает сам в редакторе hazeglow.
 *
 * Ссылка копируется из редактора как есть — целиком или только хвост. Формат
 * ссылки заранее не фиксируем: поддерживаем `#<payload>`, `?c=`, `?config=`,
 * `?gradient=` и голый payload. Payload — base64url от JSON конфига.
 *
 * Здесь живут только «краски» градиента: палитра, форма, центр, мягкость.
 * Правила проекта (эффект, размер ячейки, анимация, маска) применяются поверх,
 * чтобы присланный градиент не отменил крупный растр и не включил движение
 * там, где его быть не должно.
 */
export const HAZEGLOW_LINKS: Record<HazeglowPreset, string | null> = {
  /** Сайт студии: dither-фон секций (градиент владельца, hero лендинга). */
  site: "https://hazeglow.dev/generator#c=eyJ2ZXJzaW9uIjoxLCJzZWVkIjozLCJzaGFwZSI6ImJsb2IiLCJjZW50ZXIiOlswLjUsMC4zXSwic2l6ZSI6WzAuOSwxXSwicm91bmRuZXNzIjowLjQ1LCJzb2Z0bmVzcyI6MC4yMiwicm90YXRpb24iOjAsInJhbXBEaXJlY3Rpb24iOjAuNTUsImFuZ2xlIjo5MCwid2FycCI6MC42LCJ3YXJwU2NhbGUiOjEsInBhbGV0dGUiOlsiI2EwYjJjZiIsIiNhNWIxYzAiLCIjYTlhMzljIiwiI2Y1ODIyMCIsIiNlYTRmMDgiXSwiYmFja2dyb3VuZCI6IiMwMDAwMDAiLCJtZXNoIjpbWzAuODkxLDAuMDA3LCIjMWQyYzQ0Il0sWzAuMDExLDAuNjc5LCIjNWI2ZjhhIl0sWzAuOTQ3LDAuNzc3LCIjYTlhMzljIl0sWzAuNDIzLDAuODkzLCIjZjU4MjIwIl0sWzAuMTIxLDAuMTM5LCIjZWE0ZjA4Il0sWzAuNDQ1LDAuNDMzLCIjMDAwMDAwIl0sWzAuMzg5LDAuMTEyLCIjMWQyYzQ0Il0sWzAuMTcxLDAuODIsIiM1YjZmOGEiXV0sImdyYWluIjowLjI1LCJtb3Rpb24iOiJkcmlmdCIsInNwZWVkIjoxLCJsb29wIjowLCJob3ZlciI6MCwiaG92ZXJNb2RlIjoicHVzaCIsImVmZmVjdCI6ImRpdGhlciIsImVmZmVjdFNpemUiOjQsImVmZmVjdEFtb3VudCI6MC4xNX0",
  /** Line Launcher и страницы софта: ascii-фон. */
  software: null,
};

export type HazeglowPreset = "site" | "software";

/** Вытащить payload из ссылки или вернуть строку как есть. */
function payloadOf(link: string): string | null {
  const value = link.trim();
  if (!value) return null;
  const hash = value.includes("#") ? value.slice(value.indexOf("#") + 1) : "";
  if (hash) {
    // Ссылка редактора кладёт в хеш параметр целиком: `#c=<payload>`.
    const inner = hash.includes("=") ? hash.slice(hash.indexOf("=") + 1) : hash;
    return inner || null;
  }
  const queryStart = value.indexOf("?");
  if (queryStart >= 0) {
    const params = new URLSearchParams(value.slice(queryStart + 1));
    for (const key of ["c", "config", "gradient", "preset"]) {
      const found = params.get(key);
      if (found) return found;
    }
    return null;
  }
  return value;
}

/**
 * Разобрать присланную ссылку в конфиг.
 *
 * `decodeConfig` из библиотеки молча отдаёт конфиг по умолчанию на битых данных,
 * поэтому сначала проверяем JSON сами: иначе опечатка в ссылке выглядела бы как
 * «градиент применился, но какой-то чужой».
 */
export function presetConfig(
  preset: HazeglowPreset,
): Partial<GradientConfig> | null {
  const link = HAZEGLOW_LINKS[preset];
  const payload = link ? payloadOf(link) : null;
  if (!payload) return null;
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    const json = JSON.parse(atob(padded)) as { version?: number };
    if (json?.version !== 1) return null;
    return decodeConfig(payload);
  } catch {
    return null;
  }
}
