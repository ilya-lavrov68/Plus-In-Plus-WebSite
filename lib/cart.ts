import { auth } from "@/auth";
import type { Locale } from "@/i18n";
import { findAccountById } from "@/lib/accounts";
import { isAuthConfigured } from "@/lib/auth-secret";
import {
  findCartOrder,
  insertOrder,
  listOrderItems,
  listProductsByIds,
  updateOrder,
  type OrderItemRecord,
  type OrderRecord,
  type ProductRecord,
} from "@/lib/commerce-data";
import { canAddServiceToCart, MAX_CART_QUANTITY } from "@/lib/commerce";
import { productCover, serviceCover } from "@/lib/content-placeholders";
import { getServicesByIds, normalizeService, toPublicServiceItem, type ServiceModel } from "@/lib/data";
import { calculateEstimate } from "@/lib/pricing";
import { getRequestLocale } from "@/lib/request-locale";
import { localizePublicServices } from "@/lib/service-localization";
import { isUniqueConstraintError } from "@/lib/accounts";

export type CartItemType = "service" | "product";
export interface UnifiedCartItem {
  id: string;
  orderId: string;
  itemType: CartItemType;
  itemId: string;
  quantity: number;
  name: string;
  price: number;
  category?: string;
  slug?: string;
  coverImage?: string;
  unavailable: boolean;
  maxQuantity: number;
}
export interface UnifiedCartPayload {
  id: string | null;
  deadline: Date | null;
  description: string | null;
  items: UnifiedCartItem[];
  count: number;
}
export interface CartLineOption { group: string; option: string }
export interface CartLine {
  id: string;
  itemType: CartItemType;
  itemId: string;
  serviceId?: string;
  title: string;
  slug: string;
  coverImage: string;
  quantity: number;
  currency: string;
  options: CartLineOption[];
  optionIds: string[];
  unitEstimate: number;
  lineEstimate: number;
  unavailable: boolean;
  showPrice: boolean;
}
export interface CartView { lines: CartLine[]; count: number; totalEstimate: number; currency: string }
const EMPTY_CART: CartView = { lines: [], count: 0, totalEstimate: 0, currency: "RUB" };

function lineTargetId(item: OrderItemRecord): string {
  return item.itemId || item.serviceId || item.productId || "";
}

function serviceIdsOf(items: readonly OrderItemRecord[]): string[] {
  return [...new Set(items.filter((item) => item.itemType === "service").map(lineTargetId).filter(Boolean))];
}
function productIdsOf(items: readonly OrderItemRecord[]): string[] {
  return [...new Set(items.filter((item) => item.itemType === "product").map(lineTargetId).filter(Boolean))];
}

export async function requireActiveCustomer(): Promise<{ id: string; email: string } | null> {
  try {
    if (!isAuthConfigured()) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    const account = await findAccountById(session.user.id);
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

export interface CartOrder extends OrderRecord { items: OrderItemRecord[] }

/**
 * Корзина пользователя. Гонку двух первых запросов ловит уникальный индекс
 * `orders_cart_key_idx`: проигравший просто перечитывает созданную корзину.
 */
export async function getOrCreateCartOrder(userId: string): Promise<CartOrder> {
  const existing = await findCartOrder(userId);
  if (existing) return { ...existing, items: await listOrderItems(existing.id) };
  try {
    const created = await insertOrder({ userId, status: "cart", cartKey: userId });
    return { ...created, items: [] };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrent = await findCartOrder(userId);
    if (!concurrent) throw error;
    return { ...concurrent, items: await listOrderItems(concurrent.id) };
  }
}

export async function syncCartEstimatedAmount(orderId: string): Promise<number> {
  const items = await listOrderItems(orderId);
  const estimatedAmount = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  await updateOrder(orderId, { estimatedAmount });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function enrichCartItems(
  rawItems: OrderItemRecord[],
  locale: Locale,
): Promise<UnifiedCartItem[]> {
  if (rawItems.length === 0) return [];
  const [services, products] = await Promise.all([
    getServicesByIds(serviceIdsOf(rawItems)),
    listProductsByIds(productIdsOf(rawItems)),
  ]);
  const normalizedServices = services.map(normalizeService);
  const localizedServices = localizePublicServices(normalizedServices.map((service) => toPublicServiceItem(service)), locale);
  const localizedServiceMap = new Map(localizedServices.map((service) => [service.id, service]));
  const rawServiceMap = new Map(normalizedServices.map((service) => [service.id, service]));
  const productMap = new Map<string, ProductRecord>(products.map((product) => [product.id, product]));

  return rawItems.map((item) => {
    if (item.itemType === "product") {
      const targetId = lineTargetId(item);
      const product = productMap.get(targetId);
      return {
        id: item.id, orderId: item.orderId, itemType: "product", itemId: targetId, quantity: item.quantity,
        name: product?.name || item.title || (locale === "ru" ? "Неизвестный товар" : "Unknown Product"),
        price: product?.price ?? (item.estimatedUnitPrice > 0 ? Math.round(item.estimatedUnitPrice / 100) : 0),
        category: product?.category ?? undefined,
        slug: product?.slug ?? undefined,
        coverImage: product?.coverImage ?? product?.cover.url ?? undefined,
        unavailable: !product || !product.isActive,
        maxQuantity: Math.max(0, Math.min(MAX_CART_QUANTITY, product?.stock ?? 0)),
      };
    }
    const targetId = lineTargetId(item);
    const localized = localizedServiceMap.get(targetId);
    const raw = rawServiceMap.get(targetId);
    return {
      id: item.id, orderId: item.orderId, itemType: "service", itemId: targetId, quantity: item.quantity,
      name: localized?.name || raw?.title || item.title || (locale === "ru" ? "Неизвестная услуга" : "Unknown Service"),
      price: item.estimatedUnitPrice > 0 ? Math.round(item.estimatedUnitPrice / 100) : localized?.basePrice ?? (raw ? Math.round(raw.basePrice / 100) : 0),
      category: raw?.category ?? undefined,
      slug: raw?.slug ?? undefined,
      coverImage: raw?.coverImage ?? undefined,
      unavailable: !raw || !canAddServiceToCart(raw),
      maxQuantity: MAX_CART_QUANTITY,
    };
  });
}

function parseOptions(snapshot: string): { optionIds: string[]; options: CartLineOption[] } {
  try {
    const parsed = JSON.parse(snapshot) as Array<{ optionId?: string; group?: string; option?: string }>;
    if (!Array.isArray(parsed)) return { optionIds: [], options: [] };
    return {
      optionIds: parsed.map((entry) => entry?.optionId).filter((id): id is string => typeof id === "string"),
      options: parsed.filter((entry) => entry?.group && entry?.option).map((entry) => ({ group: String(entry.group), option: String(entry.option) })),
    };
  } catch {
    return { optionIds: [], options: [] };
  }
}

export async function getCart(): Promise<CartView> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return EMPTY_CART;
  try {
    const [cart, locale] = await Promise.all([findCartOrder(userId), getRequestLocale()]);
    if (!cart) return EMPTY_CART;
    const rawItems = await listOrderItems(cart.id);
    if (rawItems.length === 0) return EMPTY_CART;
    const [enriched, services, products] = await Promise.all([
      enrichCartItems(rawItems, locale),
      getServicesByIds(serviceIdsOf(rawItems), { withOptions: true }),
      listProductsByIds(productIdsOf(rawItems)),
    ]);
    const enrichedMap = new Map(enriched.map((item) => [item.id, item]));
    const serviceMap = new Map<string, ServiceModel>(services.map((service) => [service.id, normalizeService(service)]));
    const productMap = new Map<string, ProductRecord>(products.map((product) => [product.id, product]));
    const lines: CartLine[] = [];
    for (const item of rawItems) {
      const info = enrichedMap.get(item.id);
      const targetId = lineTargetId(item);
      if (item.itemType === "product") {
        const product = productMap.get(targetId);
        const unitKopecks = product ? Math.round(product.price * 100) : item.estimatedUnitPrice;
        lines.push({
          id: item.id, itemType: "product", itemId: targetId, title: info?.name || item.title || "Product",
          slug: product?.slug ?? "", coverImage: productCover(product?.coverImage ?? product?.cover.url ?? null), quantity: item.quantity,
          currency: "RUB", options: [], optionIds: [], unitEstimate: unitKopecks, lineEstimate: unitKopecks * item.quantity,
          unavailable: !product || !product.isActive, showPrice: true,
        });
        continue;
      }
      const service = serviceMap.get(targetId);
      if (!service) continue;
      const { optionIds, options } = parseOptions(item.optionsSnapshot);
      const unitKopecks = optionIds.length > 0 && service.optionGroups.length > 0
        ? calculateEstimate({ basePrice: service.basePrice, priceType: service.priceType, groups: service.optionGroups }, optionIds).estimatedAmount
        : item.estimatedUnitPrice > 0 ? item.estimatedUnitPrice : service.basePrice;
      lines.push({
        id: item.id, itemType: "service", itemId: item.itemId || service.id, serviceId: service.id, title: info?.name || service.title,
        slug: service.slug, coverImage: serviceCover(service.coverImage), quantity: item.quantity, currency: service.currency,
        options, optionIds, unitEstimate: unitKopecks, lineEstimate: unitKopecks * item.quantity,
        unavailable: !service.isActive || !service.isPublished, showPrice: service.priceType !== "quote" || service.basePrice > 0,
      });
    }
    const available = lines.filter((line) => !line.unavailable);
    return { lines, count: lines.reduce((sum, line) => sum + line.quantity, 0), totalEstimate: available.reduce((sum, line) => sum + line.lineEstimate, 0), currency: lines[0]?.currency ?? "RUB" };
  } catch (error) {
    console.error("Failed to load the cart:", error);
    return EMPTY_CART;
  }
}

export async function getCartCount(): Promise<number> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return 0;
  try {
    const cart = await findCartOrder(userId);
    if (!cart) return 0;
    return (await listOrderItems(cart.id)).reduce((sum, item) => sum + item.quantity, 0);
  } catch (error) {
    console.error("Failed to count the cart items:", error);
    return 0;
  }
}
