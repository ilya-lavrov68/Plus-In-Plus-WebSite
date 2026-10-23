import { auth } from "@/auth";
import type { Locale } from "@/i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { toPublicServiceItem } from "@/lib/data";
import { calculateEstimate } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
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
  /** Price per unit in rubles (₽). */
  price: number;
  category?: string;
  slug?: string;
  coverImage?: string;
}

export interface UnifiedCartPayload {
  id: string | null;
  deadline: Date | null;
  description: string | null;
  items: UnifiedCartItem[];
  count: number;
}

export interface CartLineOption {
  group: string;
  option: string;
}

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
  /** Estimated unit price in kopecks. */
  unitEstimate: number;
  /** Estimated line price (unit * quantity) in kopecks. */
  lineEstimate: number;
  unavailable: boolean;
  showPrice: boolean;
}

export interface CartView {
  lines: CartLine[];
  count: number;
  totalEstimate: number;
  currency: string;
}

const EMPTY_CART: CartView = {
  lines: [],
  count: 0,
  totalEstimate: 0,
  currency: "RUB",
};

export async function requireActiveCustomer(): Promise<{
  id: string;
  email: string;
} | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id) return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isBlocked: true },
    });
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

export async function getOrCreateCartOrder(userId: string) {
  if (!prisma) throw new Error("Database is not configured");

  let cart = await prisma.order.findFirst({
    where: { userId, status: "cart" },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (!cart) {
    cart = await prisma.order.create({
      data: { userId, status: "cart" },
      include: { items: { orderBy: { id: "asc" } } },
    });
  }

  return cart;
}

export async function syncCartEstimatedAmount(orderId: string): Promise<number> {
  if (!prisma) return 0;
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, estimatedUnitPrice: true },
  });
  const estimatedAmount = items.reduce(
    (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
    0
  );
  await prisma.order.update({
    where: { id: orderId },
    data: { estimatedAmount },
  });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function enrichCartItems(
  rawItems: Array<{
    id: string;
    orderId: string;
    itemType: string;
    itemId: string;
    serviceId: string | null;
    productId: string | null;
    title: string;
    quantity: number;
    estimatedUnitPrice: number;
  }>,
  locale: Locale
): Promise<UnifiedCartItem[]> {
  if (!prisma || rawItems.length === 0) return [];

  const serviceIds = Array.from(
    new Set(
      rawItems
        .filter((i) => i.itemType === "service")
        .map((i) => i.itemId || i.serviceId || "")
        .filter(Boolean)
    )
  );
  const productIds = Array.from(
    new Set(
      rawItems
        .filter((i) => i.itemType === "product")
        .map((i) => i.itemId || i.productId || "")
        .filter(Boolean)
    )
  );

  const [services, products] = await Promise.all([
    serviceIds.length > 0
      ? prisma.service.findMany({ where: { id: { in: serviceIds } } })
      : Promise.resolve([]),
    productIds.length > 0
      ? prisma.product.findMany({ where: { id: { in: productIds } } })
      : Promise.resolve([]),
  ]);

  const localizedServices = localizePublicServices(
    services.map(toPublicServiceItem),
    locale
  );
  const localizedServiceMap = new Map(localizedServices.map((s) => [s.id, s]));
  const rawServiceMap = new Map(services.map((s) => [s.id, s]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  return rawItems.map((item) => {
    if (item.itemType === "product") {
      const targetId = item.itemId || item.productId || "";
      const product = productMap.get(targetId);
      const fallbackRub =
        item.estimatedUnitPrice > 0
          ? Math.round(item.estimatedUnitPrice / 100)
          : 0;
      return {
        id: item.id,
        orderId: item.orderId,
        itemType: "product",
        itemId: targetId,
        quantity: item.quantity,
        name:
          product?.name ||
          item.title ||
          (locale === "ru" ? "Неизвестный товар" : "Unknown Product"),
        price: product?.price ?? fallbackRub,
        category: product?.category ?? undefined,
        slug: product?.slug ?? undefined,
        coverImage: product?.coverImage ?? undefined,
      };
    }

    const targetId = item.itemId || item.serviceId || "";
    const localizedSvc = localizedServiceMap.get(targetId);
    const rawSvc = rawServiceMap.get(targetId);
    const priceRub =
      item.estimatedUnitPrice > 0
        ? Math.round(item.estimatedUnitPrice / 100)
        : localizedSvc?.basePrice ??
          (rawSvc ? Math.round(rawSvc.basePrice / 100) : 0);

    return {
      id: item.id,
      orderId: item.orderId,
      itemType: "service",
      itemId: targetId,
      quantity: item.quantity,
      name:
        localizedSvc?.name ||
        rawSvc?.title ||
        item.title ||
        (locale === "ru" ? "Неизвестная услуга" : "Unknown Service"),
      price: priceRub,
      category: rawSvc?.category ?? undefined,
      slug: rawSvc?.slug ?? undefined,
      coverImage: rawSvc?.coverImage ?? undefined,
    };
  });
}

export async function getCart(): Promise<CartView> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return EMPTY_CART;

  try {
    const [cart, locale] = await Promise.all([
      prisma.order.findFirst({
        where: { userId, status: "cart" },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { id: "asc" },
            include: {
              service: {
                include: {
                  optionGroups: {
                    orderBy: { sortOrder: "asc" },
                    include: { options: { orderBy: { sortOrder: "asc" } } },
                  },
                },
              },
              product: true,
            },
          },
        },
      }),
      getRequestLocale(),
    ]);

    if (!cart || cart.items.length === 0) return EMPTY_CART;

    const enriched = await enrichCartItems(cart.items, locale);
    const enrichedMap = new Map(enriched.map((e) => [e.id, e]));

    const lines: CartLine[] = [];
    for (const item of cart.items) {
      const info = enrichedMap.get(item.id);
      if (item.itemType === "product") {
        const product = item.product;
        const unitKopecks = product
          ? Math.round(product.price * 100)
          : item.estimatedUnitPrice;
        const unavailable = !product || !product.isActive;
        lines.push({
          id: item.id,
          itemType: "product",
          itemId: item.itemId || item.productId || "",
          title: info?.name || item.title || "Product",
          slug: product?.slug ?? "",
          coverImage: product?.coverImage ?? "/assets/shop/bag-design.jpg",
          quantity: item.quantity,
          currency: "RUB",
          options: [],
          optionIds: [],
          unitEstimate: unitKopecks,
          lineEstimate: unitKopecks * item.quantity,
          unavailable,
          showPrice: true,
        });
        continue;
      }

      const service = item.service;
      if (!service) continue;
      const unavailable = !service.isActive || !service.isPublished;

      let optionIds: string[] = [];
      let options: CartLineOption[] = [];
      try {
        const parsed = JSON.parse(item.optionsSnapshot) as Array<{
          optionId?: string;
          group?: string;
          option?: string;
        }>;
        optionIds = parsed
          .map((entry) => entry?.optionId)
          .filter((id): id is string => typeof id === "string");
        options = parsed
          .filter((entry) => entry?.group && entry?.option)
          .map((entry) => ({
            group: String(entry.group),
            option: String(entry.option),
          }));
      } catch {
        optionIds = [];
      }

      const unitKopecks =
        optionIds.length > 0 && service.optionGroups.length > 0
          ? calculateEstimate(
              {
                basePrice: service.basePrice,
                priceType: service.priceType,
                groups: service.optionGroups,
              },
              optionIds
            ).estimatedAmount
          : item.estimatedUnitPrice > 0
            ? item.estimatedUnitPrice
            : service.basePrice;

      lines.push({
        id: item.id,
        itemType: "service",
        itemId: item.itemId || service.id,
        serviceId: service.id,
        title: info?.name || service.title,
        slug: service.slug,
        coverImage: service.coverImage,
        quantity: item.quantity,
        currency: service.currency,
        options,
        optionIds,
        unitEstimate: unitKopecks,
        lineEstimate: unitKopecks * item.quantity,
        unavailable,
        showPrice: service.priceType !== "quote" || service.basePrice > 0,
      });
    }

    const available = lines.filter((line) => !line.unavailable);
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      totalEstimate: available.reduce((sum, line) => sum + line.lineEstimate, 0),
      currency: lines[0]?.currency ?? "RUB",
    };
  } catch (error) {
    console.error("Failed to load the cart:", error);
    return EMPTY_CART;
  }
}

export async function getCartCount(): Promise<number> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return 0;
  try {
    const cart = await prisma.order.findFirst({
      where: { userId, status: "cart" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!cart) return 0;
    const aggregate = await prisma.orderItem.aggregate({
      where: { orderId: cart.id },
      _sum: { quantity: true },
    });
    return aggregate._sum.quantity ?? 0;
  } catch (error) {
    console.error("Failed to count the cart items:", error);
    return 0;
  }
}
