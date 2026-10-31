import { auth } from "@/auth";
import type { Locale } from "@/i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { canAddServiceToCart, MAX_CART_QUANTITY } from "@/lib/commerce";
import { productCover, serviceCover } from "@/lib/content-placeholders";
import { toPublicServiceItem } from "@/lib/data";
import { calculateEstimate } from "@/lib/pricing";
import { getPayloadClient, payloadDate, payloadId } from "@/lib/payload-native";
import { getRequestLocale } from "@/lib/request-locale";
import { localizePublicServices } from "@/lib/service-localization";

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

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>;

function normalizeService(service: any): any {
  if (!service) return service;
  const values = (value: unknown) => Array.isArray(value)
    ? value.map((item) => typeof item === "object" && item !== null && "value" in item ? (item as { value: unknown }).value : item).filter((item) => typeof item === "string")
    : value;
  return {
    ...service,
    coverImage: service.coverImage ?? (typeof service.cover === "object" ? service.cover?.url : null) ?? "",
    includes: typeof service.includes === "string" ? service.includes : JSON.stringify(values(service.includes) ?? []),
    shapes: typeof service.shapes === "string" ? service.shapes : JSON.stringify(values(service.shapes) ?? []),
    optionGroups: service.optionGroups ?? [],
  };
}

async function findCart(payload: PayloadClient, userId: string) {
  const result = await payload.find({
    collection: "orders",
    depth: 0,
    limit: 1,
    sort: "-createdAt",
    overrideAccess: true,
    where: { and: [{ userId: { equals: userId } }, { status: { equals: "cart" } }] },
  });
  return (result.docs[0] as any) ?? null;
}
async function cartItems(payload: PayloadClient, orderId: string) {
  const result = await payload.find({
    collection: "order-items",
    depth: 0,
    pagination: false,
    sort: "id",
    overrideAccess: true,
    where: { orderId: { equals: orderId } },
  });
  return result.docs as any[];
}

export async function requireActiveCustomer(): Promise<{ id: string; email: string } | null> {
  try {
    if (!isAuthConfigured()) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    const payload = await getPayloadClient();
    const result = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, where: { id: { equals: session.user.id } } });
    const account = result.docs[0];
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

export async function getOrCreateCartOrder(userId: string) {
  const payload = await getPayloadClient();
  let cart = await findCart(payload, userId);
  if (!cart) {
    try {
      cart = await payload.create({ collection: "orders", data: { userId, status: "cart", cartKey: userId }, depth: 0, overrideAccess: true });
    } catch {
      // Другой первый запрос уже создал уникальный cartKey — читаем его.
      cart = await findCart(payload, userId);
    }
  }
  if (!cart) throw new Error("Unable to create cart");
  return { ...cart, deadline: payloadDate(cart.deadline), items: await cartItems(payload, cart.id) };
}

export async function syncCartEstimatedAmount(orderId: string): Promise<number> {
  const payload = await getPayloadClient();
  const items = await cartItems(payload, orderId);
  const estimatedAmount = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  await payload.update({ collection: "orders", id: orderId, data: { estimatedAmount }, overrideAccess: true });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function enrichCartItems(
  rawItems: Array<{ id: string; orderId: string; itemType: string; itemId: string; serviceId: string | null; productId: string | null; title: string; quantity: number; estimatedUnitPrice: number }>,
  locale: Locale,
): Promise<UnifiedCartItem[]> {
  if (rawItems.length === 0) return [];
  const payload = await getPayloadClient();
  const serviceIds = Array.from(new Set(rawItems.filter((item) => item.itemType === "service").map((item) => item.itemId || payloadId(item.serviceId) || "").filter(Boolean)));
  const productIds = Array.from(new Set(rawItems.filter((item) => item.itemType === "product").map((item) => item.itemId || payloadId(item.productId) || "").filter(Boolean)));
  const [serviceResult, productResult] = await Promise.all([
    serviceIds.length ? payload.find({ collection: "services", depth: 1, pagination: false, overrideAccess: true, where: { id: { in: serviceIds } } }) : Promise.resolve({ docs: [] }),
    productIds.length ? payload.find({ collection: "products", depth: 1, pagination: false, overrideAccess: true, where: { id: { in: productIds } } }) : Promise.resolve({ docs: [] }),
  ]);
  const services = (serviceResult.docs as any[]).map(normalizeService);
  const products = productResult.docs as any[];
  const localizedServices = localizePublicServices(services.map((service) => toPublicServiceItem(service)), locale);
  const localizedServiceMap = new Map(localizedServices.map((service) => [service.id, service]));
  const rawServiceMap = new Map(services.map((service) => [service.id, service]));
  const productMap = new Map(products.map((product) => [product.id, product]));

  return rawItems.map((item) => {
    if (item.itemType === "product") {
      const targetId = item.itemId || payloadId(item.productId) || "";
      const product = productMap.get(targetId);
      return {
        id: item.id, orderId: item.orderId, itemType: "product", itemId: targetId, quantity: item.quantity,
        name: product?.name || item.title || (locale === "ru" ? "Неизвестный товар" : "Unknown Product"),
        price: product?.price ?? (item.estimatedUnitPrice > 0 ? Math.round(item.estimatedUnitPrice / 100) : 0),
        category: product?.category ?? undefined,
        slug: product?.slug ?? undefined,
        coverImage: product?.coverImage ?? (typeof product?.cover === "object" ? product.cover?.url : undefined),
        unavailable: !product || !product.isActive,
        maxQuantity: Math.max(0, Math.min(MAX_CART_QUANTITY, product?.stock ?? 0)),
      };
    }
    const targetId = item.itemId || payloadId(item.serviceId) || "";
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

export async function getCart(): Promise<CartView> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return EMPTY_CART;
  try {
    const payload = await getPayloadClient();
    const [cart, locale] = await Promise.all([findCart(payload, userId), getRequestLocale()]);
    if (!cart) return EMPTY_CART;
    const rawItems = await cartItems(payload, cart.id);
    if (rawItems.length === 0) return EMPTY_CART;
    const enriched = await enrichCartItems(rawItems, locale);
    const enrichedMap = new Map(enriched.map((item) => [item.id, item]));
    const serviceIds = [...new Set(rawItems.filter((item) => item.itemType === "service").map((item) => item.itemId || payloadId(item.serviceId) || "").filter(Boolean))];
    const productIds = [...new Set(rawItems.filter((item) => item.itemType === "product").map((item) => item.itemId || payloadId(item.productId) || "").filter(Boolean))];
    const [serviceResult, productResult] = await Promise.all([
      serviceIds.length ? payload.find({ collection: "services", depth: 2, pagination: false, overrideAccess: true, where: { id: { in: serviceIds } } }) : Promise.resolve({ docs: [] }),
      productIds.length ? payload.find({ collection: "products", depth: 1, pagination: false, overrideAccess: true, where: { id: { in: productIds } } }) : Promise.resolve({ docs: [] }),
    ]);
    const serviceMap = new Map((serviceResult.docs as any[]).map((service) => [service.id, normalizeService(service)]));
    const productMap = new Map((productResult.docs as any[]).map((product) => [product.id, product]));
    const lines: CartLine[] = [];
    for (const item of rawItems) {
      const info = enrichedMap.get(item.id);
      if (item.itemType === "product") {
        const product = productMap.get(item.itemId || payloadId(item.productId) || "");
        const unitKopecks = product ? Math.round(product.price * 100) : item.estimatedUnitPrice;
        lines.push({
          id: item.id, itemType: "product", itemId: item.itemId || payloadId(item.productId) || "", title: info?.name || item.title || "Product",
          slug: product?.slug ?? "", coverImage: productCover(product?.coverImage ?? (typeof product?.cover === "object" ? product.cover?.url : null)), quantity: item.quantity,
          currency: "RUB", options: [], optionIds: [], unitEstimate: unitKopecks, lineEstimate: unitKopecks * item.quantity,
          unavailable: !product || !product.isActive, showPrice: true,
        });
        continue;
      }
      const service = serviceMap.get(item.itemId || payloadId(item.serviceId) || "");
      if (!service) continue;
      let optionIds: string[] = [];
      let options: CartLineOption[] = [];
      try {
        const parsed = JSON.parse(item.optionsSnapshot) as Array<{ optionId?: string; group?: string; option?: string }>;
        optionIds = parsed.map((entry) => entry?.optionId).filter((id): id is string => typeof id === "string");
        options = parsed.filter((entry) => entry?.group && entry?.option).map((entry) => ({ group: String(entry.group), option: String(entry.option) }));
      } catch { optionIds = []; }
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
    const payload = await getPayloadClient();
    const cart = await findCart(payload, userId);
    if (!cart) return 0;
    return (await cartItems(payload, cart.id)).reduce((sum, item) => sum + item.quantity, 0);
  } catch (error) {
    console.error("Failed to count the cart items:", error);
    return 0;
  }
}
