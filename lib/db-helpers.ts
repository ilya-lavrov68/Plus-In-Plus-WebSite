/**
 * JSON-as-TEXT helpers.
 *
 * Turso/libSQL is SQLite, which has no native JSON column type, so list fields
 * (`Service.includes`, `Service.shapes`) are stored as JSON-encoded strings and
 * converted at the edges of the application. Reading never throws: a corrupted or
 * legacy value degrades to an empty list instead of breaking a page.
 */

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Parses a stored JSON array. Accepts `null`/`undefined`/bad JSON (→ `[]`) and,
 * defensively, a plain array — which is what a legacy PostgreSQL `Json` column or
 * a hand-edited row can produce.
 */
export function parseJsonArray(field: unknown): string[] {
  if (Array.isArray(field)) return field.filter(isString);
  if (typeof field !== "string") return [];

  const trimmed = field.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.filter(isString) : [];
  } catch {
    return [];
  }
}

/** Serializes a list for storage. Non-string entries are dropped, never coerced. */
export function toJsonArray(data: readonly string[]): string {
  return JSON.stringify(data.filter(isString));
}

/** "One\n Two\n\n" → ["One", "Two"] — the textarea format used by the admin forms. */
export function parseLineList(value: string, maxItems = 100): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}
