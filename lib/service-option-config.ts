export interface ServiceOptionGroupInput {
  name: string;
  required: boolean;
  options: Array<{
    label: string;
    priceDeltaRub: string;
    priceFactor: string;
    isDefault: boolean;
  }>;
}

export interface NormalizedServiceOptionGroup {
  name: string;
  required: boolean;
  sortOrder: number;
  options: Array<{
    label: string;
    priceDelta: number;
    priceFactor: number;
    isDefault: boolean;
    sortOrder: number;
  }>;
}

const MAX_GROUPS = 50;
const MAX_OPTIONS_PER_GROUP = 100;
const MAX_PRICE_RUB = 100_000_000;

function numericText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(",", ".");
  return text && text.length <= 50 ? text : null;
}

/** Parse and normalize the admin configurator payload; money leaves this function in kopecks. */
export function parseServiceOptionConfig(raw: string): NormalizedServiceOptionGroup[] | null {
  if (raw.length > 200_000) return null;
  let input: unknown;
  try {
    input = JSON.parse(raw || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(input) || input.length > MAX_GROUPS) return null;

  const groups: NormalizedServiceOptionGroup[] = [];
  for (const [groupIndex, candidate] of input.entries()) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const group = candidate as Record<string, unknown>;
    const name = typeof group.name === "string" ? group.name.trim() : "";
    if (!name || name.length > 160 || typeof group.required !== "boolean") return null;
    if (!Array.isArray(group.options) || group.options.length < 1 || group.options.length > MAX_OPTIONS_PER_GROUP) {
      return null;
    }

    let defaultCount = 0;
    const options: NormalizedServiceOptionGroup["options"] = [];
    for (const [optionIndex, optionCandidate] of group.options.entries()) {
      if (typeof optionCandidate !== "object" || optionCandidate === null) return null;
      const option = optionCandidate as Record<string, unknown>;
      const label = typeof option.label === "string" ? option.label.trim() : "";
      const deltaText = numericText(option.priceDeltaRub);
      const factorText = numericText(option.priceFactor);
      if (!label || label.length > 160 || !deltaText || !factorText || typeof option.isDefault !== "boolean") {
        return null;
      }
      const deltaRub = Number(deltaText);
      const priceFactor = Number(factorText);
      if (
        !Number.isFinite(deltaRub) || Math.abs(deltaRub) > MAX_PRICE_RUB ||
        !Number.isFinite(priceFactor) || priceFactor <= 0 || priceFactor > 10_000
      ) {
        return null;
      }
      const priceDelta = Math.round(deltaRub * 100);
      if (!Number.isSafeInteger(priceDelta)) return null;
      if (option.isDefault) defaultCount += 1;
      options.push({
        label,
        priceDelta,
        priceFactor,
        isDefault: option.isDefault,
        sortOrder: optionIndex,
      });
    }
    if (defaultCount > 1) return null;
    groups.push({ name, required: group.required, sortOrder: groupIndex, options });
  }
  return groups;
}

/** Only meaningful persisted fields participate in change detection, never database IDs. */
export function canonicalServiceOptionConfig(
  groups: readonly NormalizedServiceOptionGroup[],
): string {
  return JSON.stringify(groups.map((group, groupIndex) => ({
    name: group.name,
    required: group.required,
    sortOrder: groupIndex,
    options: group.options.map((option, optionIndex) => ({
      label: option.label,
      priceDelta: option.priceDelta,
      priceFactor: option.priceFactor,
      isDefault: option.isDefault,
      sortOrder: optionIndex,
    })),
  })));
}
