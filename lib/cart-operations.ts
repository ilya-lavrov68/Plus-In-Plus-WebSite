import type { Prisma } from "@/lib/generated/prisma/client";

import { recordActivity } from "@/lib/activity-log";
import {
  MAX_CART_QUANTITY,
  calculateServiceSelection,
  canAddProductToCart,
  canAddServiceToCart,
  optionIdsFromSnapshot,
} from "@/lib/commerce";
import { prisma } from "@/lib/prisma";

export type CartOperationErrorCode =
  | "cartEmpty"
  | "cartItemNotFound"
  | "itemUnavailable"
  | "incompleteOptions"
  | "insufficientStock"
  | "invalidDeadline"
  | "invalidQuantity"
  | "staleCart";

export class CartOperationError extends Error {
  constructor(public readonly code: CartOperationErrorCode) {
    super(code);
    this.name = "CartOperationError";
  }
}

type Db = Prisma.TransactionClient;

type CartMutationResult = { count: number };

function database(): NonNullable<typeof prisma> {
  if (!prisma) throw new Error("Database is not configured");
  return prisma;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 128;
}

function normalizeAddQuantity(value: unknown): number {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.trunc(number) || 1));
}

function normalizeExactQuantity(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_CART_QUANTITY) {
    throw new CartOperationError("invalidQuantity");
  }
  return number;
}

async function findOwnedCart(db: Db, userId: string) {
  return db.order.findFirst({
    where: { userId, status: "cart" },
    orderBy: { createdAt: "desc" },
  });
}

async function findOwnedCartWithItems(db: Db, userId: string) {
  return db.order.findFirst({
    where: { userId, status: "cart" },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { id: "asc" } } },
  });
}

async function getOrCreateOwnedCart(db: Db, userId: string) {
  const existing = await findOwnedCartWithItems(db, userId);
  if (existing) return existing;
  return db.order.upsert({
    where: { cartKey: userId },
    create: { userId, status: "cart", cartKey: userId },
    update: {},
    include: { items: { orderBy: { id: "asc" } } },
  });
}

async function syncEstimatedAmount(db: Db, orderId: string): Promise<number> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, estimatedUnitPrice: true },
  });
  const estimatedAmount = items.reduce(
    (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
    0,
  );
  await db.order.update({ where: { id: orderId }, data: { estimatedAmount } });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

const optionTreeInclude = {
  optionGroups: {
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  },
} as const;

export async function addCartItem(
  userId: string,
  input: { itemType: "service" | "product"; itemId: string; quantity?: number; optionIds?: string[] },
): Promise<CartMutationResult> {
  const db = database();
  if (!validId(userId) || !validId(input.itemId)) {
    throw new CartOperationError("itemUnavailable");
  }
  const quantity = normalizeAddQuantity(input.quantity);

  return db.$transaction(async (tx) => {
    const cart = await getOrCreateOwnedCart(tx, userId);

    if (input.itemType === "service") {
      const service = await tx.service.findFirst({
        where: { id: input.itemId },
        include: optionTreeInclude,
      });
      if (!service || !canAddServiceToCart(service)) {
        throw new CartOperationError("itemUnavailable");
      }
      const estimate = calculateServiceSelection(service, input.optionIds ?? []);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      const optionsSnapshot = JSON.stringify(estimate.selected);
      const existing = await tx.orderItem.findFirst({
        where: {
          orderId: cart.id,
          itemType: "service",
          itemId: service.id,
          optionsSnapshot,
        },
      });
      const nextQuantity = Math.min(
        MAX_CART_QUANTITY,
        (existing?.quantity ?? 0) + quantity,
      );
      if (existing) {
        await tx.orderItem.update({
          where: { id: existing.id },
          data: {
            quantity: nextQuantity,
            title: service.title,
            estimatedUnitPrice: estimate.estimatedAmount,
          },
        });
      } else {
        await tx.orderItem.create({
          data: {
            orderId: cart.id,
            itemType: "service",
            itemId: service.id,
            serviceId: service.id,
            title: service.title,
            quantity,
            estimatedUnitPrice: estimate.estimatedAmount,
            optionsSnapshot,
          },
        });
      }
    } else {
      const product = await tx.product.findFirst({ where: { id: input.itemId } });
      if (!product || !product.isActive) {
        throw new CartOperationError("itemUnavailable");
      }
      const existing = await tx.orderItem.findFirst({
        where: { orderId: cart.id, itemType: "product", itemId: product.id },
      });
      const nextQuantity = Math.min(
        MAX_CART_QUANTITY,
        (existing?.quantity ?? 0) + quantity,
      );
      if (!canAddProductToCart(product, nextQuantity)) {
        throw new CartOperationError("insufficientStock");
      }
      const estimatedUnitPrice = Math.round(product.price * 100);
      if (existing) {
        await tx.orderItem.update({
          where: { id: existing.id },
          data: { quantity: nextQuantity, title: product.name, estimatedUnitPrice },
        });
      } else {
        await tx.orderItem.create({
          data: {
            orderId: cart.id,
            itemType: "product",
            itemId: product.id,
            productId: product.id,
            title: product.name,
            quantity,
            estimatedUnitPrice,
            optionsSnapshot: "[]",
          },
        });
      }
    }

    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

export async function updateOwnedCartItem(
  userId: string,
  input: { id: string; quantity: number },
): Promise<CartMutationResult> {
  const db = database();
  if (!validId(input.id)) throw new CartOperationError("cartItemNotFound");
  const quantity = normalizeExactQuantity(input.quantity);

  return db.$transaction(async (tx) => {
    const cart = await findOwnedCart(tx, userId);
    if (!cart) throw new CartOperationError("cartItemNotFound");
    const line = await tx.orderItem.findFirst({
      where: { id: input.id, orderId: cart.id },
    });
    if (!line) throw new CartOperationError("cartItemNotFound");

    if (line.itemType === "service") {
      const serviceId = line.itemId || line.serviceId || "";
      const service = await tx.service.findFirst({
        where: { id: serviceId },
        include: optionTreeInclude,
      });
      if (!service || !canAddServiceToCart(service)) {
        throw new CartOperationError("itemUnavailable");
      }
      const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
      const estimate = optionIds === null
        ? null
        : calculateServiceSelection(service, optionIds);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      await tx.orderItem.update({
        where: { id: line.id },
        data: {
          quantity,
          title: service.title,
          estimatedUnitPrice: estimate.estimatedAmount,
          optionsSnapshot: JSON.stringify(estimate.selected),
        },
      });
    } else if (line.itemType === "product") {
      const productId = line.itemId || line.productId || "";
      const product = await tx.product.findFirst({ where: { id: productId } });
      if (!product || !product.isActive) {
        throw new CartOperationError("itemUnavailable");
      }
      if (!canAddProductToCart(product, quantity)) {
        throw new CartOperationError("insufficientStock");
      }
      await tx.orderItem.update({
        where: { id: line.id },
        data: {
          quantity,
          title: product.name,
          estimatedUnitPrice: Math.round(product.price * 100),
        },
      });
    } else {
      throw new CartOperationError("itemUnavailable");
    }

    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

export async function removeOwnedCartItem(
  userId: string,
  id: string,
): Promise<CartMutationResult> {
  const db = database();
  if (!validId(id)) throw new CartOperationError("cartItemNotFound");
  return db.$transaction(async (tx) => {
    const cart = await findOwnedCart(tx, userId);
    if (!cart) return { count: 0 };
    const removed = await tx.orderItem.deleteMany({
      where: { id, orderId: cart.id },
    });
    if (!removed.count) throw new CartOperationError("cartItemNotFound");
    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const candidate = new Date(raw);
  if (Number.isNaN(candidate.getTime())) {
    throw new CartOperationError("invalidDeadline");
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = new Date(candidate);
  day.setUTCHours(0, 0, 0, 0);
  if (day < today) throw new CartOperationError("invalidDeadline");
  return day;
}

function orderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

/** Revalidates every line and derives a fresh estimate; agreed prices and stock are not changed here. */
export async function checkoutOwnedCart(
  userId: string,
  input: { note?: string | null; deadline?: string | null } = {},
): Promise<{ orderNumber: string }> {
  const db = database();
  const deadline = parseDeadline(input.deadline);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 4000) : "";
  const baseCount = await db.order.count({ where: { status: { not: "cart" } } });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = orderNumber(baseCount + 1 + attempt);
    try {
      return await db.$transaction(async (tx) => {
        const cart = await findOwnedCartWithItems(tx, userId);
        if (!cart || cart.items.length === 0) {
          throw new CartOperationError("cartEmpty");
        }

        const serviceIds = [...new Set(cart.items
          .filter((item) => item.itemType === "service")
          .map((item) => item.itemId || item.serviceId || "")
          .filter(Boolean))];
        const productIds = [...new Set(cart.items
          .filter((item) => item.itemType === "product")
          .map((item) => item.itemId || item.productId || "")
          .filter(Boolean))];
        const [services, products] = await Promise.all([
          serviceIds.length
            ? tx.service.findMany({ where: { id: { in: serviceIds } }, include: optionTreeInclude })
            : Promise.resolve([]),
          productIds.length
            ? tx.product.findMany({ where: { id: { in: productIds } } })
            : Promise.resolve([]),
        ]);
        const serviceMap = new Map(services.map((service) => [service.id, service]));
        const productMap = new Map(products.map((product) => [product.id, product]));
        const productQuantities = new Map<string, number>();
        for (const line of cart.items) {
          if (line.itemType !== "product") continue;
          const id = line.itemId || line.productId || "";
          productQuantities.set(id, (productQuantities.get(id) ?? 0) + line.quantity);
        }
        for (const [id, quantity] of productQuantities) {
          const product = productMap.get(id);
          if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
          if (!canAddProductToCart(product, quantity)) {
            throw new CartOperationError("insufficientStock");
          }
        }

        let estimatedAmount = 0;
        const serviceQuantities = new Map<string, number>();
        const refreshedTitles: string[] = [];
        for (const line of cart.items) {
          if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_CART_QUANTITY) {
            throw new CartOperationError("invalidQuantity");
          }

          if (line.itemType === "service") {
            const id = line.itemId || line.serviceId || "";
            const service = serviceMap.get(id);
            if (!service || !canAddServiceToCart(service)) {
              throw new CartOperationError("itemUnavailable");
            }
            const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
            const estimate = optionIds === null
              ? null
              : calculateServiceSelection(service, optionIds);
            if (!estimate) throw new CartOperationError("incompleteOptions");
            estimatedAmount += estimate.estimatedAmount * line.quantity;
            serviceQuantities.set(id, (serviceQuantities.get(id) ?? 0) + line.quantity);
            refreshedTitles.push(service.title);
            await tx.orderItem.update({
              where: { id: line.id },
              data: {
                title: service.title,
                estimatedUnitPrice: estimate.estimatedAmount,
                optionsSnapshot: JSON.stringify(estimate.selected),
              },
            });
          } else if (line.itemType === "product") {
            const id = line.itemId || line.productId || "";
            const product = productMap.get(id);
            if (!product) throw new CartOperationError("itemUnavailable");
            const unitEstimate = Math.round(product.price * 100);
            estimatedAmount += unitEstimate * line.quantity;
            refreshedTitles.push(product.name);
            await tx.orderItem.update({
              where: { id: line.id },
              data: { title: product.name, estimatedUnitPrice: unitEstimate },
            });
          } else {
            throw new CartOperationError("itemUnavailable");
          }
        }

        await tx.orderService.deleteMany({ where: { orderId: cart.id } });
        if (serviceQuantities.size) {
          await tx.orderService.createMany({
            data: [...serviceQuantities].map(([serviceId, quantity]) => ({
              orderId: cart.id,
              serviceId,
              quantity,
            })),
          });
        }

        // A concurrent checkout cannot submit the same cart twice.
        const transitioned = await tx.order.updateMany({
          where: { id: cart.id, userId, status: "cart" },
          data: {
            status: "pending",
            cartKey: null,
            orderNumber: number,
            number,
            deadline,
            description: note || null,
            customerNote: note || null,
            estimatedAmount,
          },
        });
        if (transitioned.count !== 1) throw new CartOperationError("staleCart");

        await recordActivity(tx, {
          action: "create",
          entityType: "order",
          entityId: cart.id,
          title: `${number} — ${refreshedTitles.join(", ").slice(0, 180)}`,
          actorId: userId,
        });
        return { orderNumber: number };
      });
    } catch (error) {
      if (error instanceof CartOperationError) throw error;
      if ((error as { code?: string })?.code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to allocate an order number");
}
