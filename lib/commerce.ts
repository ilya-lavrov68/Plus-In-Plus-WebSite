import { calculateEstimate, type PriceCalculation } from "@/lib/pricing";

export const MAX_CART_QUANTITY = 99;

export interface CommerceServiceOption {
  id: string;
  label: string;
  priceDelta: number;
  priceFactor: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface CommerceServiceOptionGroup {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: CommerceServiceOption[];
}

export interface CommerceService {
  id: string;
  title: string;
  basePrice: number;
  priceType: string;
  currency: string;
  isActive: boolean;
  isPublished: boolean;
  isOrderable: boolean;
  optionGroups?: CommerceServiceOptionGroup[];
}

/** A quote request is the manager-assisted flow and remains available for quote-only services. */
export function canRequestServiceQuote(
  service: { isActive?: boolean | null; isPublished?: boolean | null },
): boolean {
  return service.isActive === true && service.isPublished === true;
}

/** Self-service cart lines require an active, published, explicitly orderable priced service. */
export function canAddServiceToCart(
  service: {
    isActive?: boolean | null;
    isPublished?: boolean | null;
    isOrderable?: boolean | null;
    priceType: string;
  },
): boolean {
  return (
    canRequestServiceQuote(service) &&
    service.isOrderable === true &&
    service.priceType !== "quote"
  );
}

export function canAddProductToCart(
  product: { isActive?: boolean | null; stock: number },
  quantity = 1,
): boolean {
  return product.isActive === true && Number.isInteger(quantity) && quantity > 0 && product.stock >= quantity;
}

/**
 * Resolves only option IDs owned by this service. Required groups use their configured
 * default when a simple add-to-cart button did not submit a configurator selection.
 */
interface ServiceSelectionInput {
  basePrice: number;
  priceType: string;
  optionGroups?: Array<{
    id?: string | null;
    name: string;
    required?: boolean | null;
    sortOrder: number;
    options?: Array<{
      id?: string | null;
      label: string;
      priceDelta: number;
      priceFactor: number;
      isDefault?: boolean | null;
      sortOrder: number;
    }> | null;
  }> | null;
}

export function calculateServiceSelection(
  service: ServiceSelectionInput,
  rawOptionIds: unknown,
): PriceCalculation | null {
  if (
    rawOptionIds !== undefined &&
    (!Array.isArray(rawOptionIds) || rawOptionIds.length > 100)
  ) {
    return null;
  }

  const optionIds = rawOptionIds ?? [];
  if (optionIds.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return null;
  }

  const groups: CommerceServiceOptionGroup[] = (service.optionGroups ?? []).flatMap((group) => {
    if (!group.id) return [];
    const options = (group.options ?? []).flatMap((option) => option.id ? [{
      id: option.id,
      label: option.label,
      priceDelta: option.priceDelta,
      priceFactor: option.priceFactor,
      isDefault: option.isDefault === true,
      sortOrder: option.sortOrder,
    }] : []);
    return [{
      id: group.id,
      name: group.name,
      required: group.required === true,
      sortOrder: group.sortOrder,
      options,
    }];
  });
  const chosenByGroup = new Map<string, string>();
  for (const optionId of optionIds as string[]) {
    const group = groups.find((candidate) =>
      candidate.options.some((option) => option.id === optionId),
    );
    // Unknown options and two options from one group are not a valid configuration.
    if (!group || chosenByGroup.has(group.id)) return null;
    chosenByGroup.set(group.id, optionId);
  }

  for (const group of groups) {
    if (!group.required || chosenByGroup.has(group.id)) continue;
    const fallback =
      group.options.find((option) => option.isDefault) ?? group.options[0];
    if (!fallback) return null;
    chosenByGroup.set(group.id, fallback.id);
  }

  const estimate = calculateEstimate(
    {
      basePrice: service.basePrice,
      priceType: service.priceType,
      groups,
    },
    [...chosenByGroup.values()],
  );
  return estimate.complete ? estimate : null;
}

export function optionIdsFromSnapshot(snapshot: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return null;
    const ids: string[] = [];
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as { optionId?: unknown }).optionId !== "string"
      ) {
        return null;
      }
      ids.push((entry as { optionId: string }).optionId);
    }
    return ids;
  } catch {
    return null;
  }
}
