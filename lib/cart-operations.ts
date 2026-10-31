import type { PayloadRequest } from "payload";

import {
  MAX_CART_QUANTITY,
  calculateServiceSelection,
  canAddProductToCart,
  canAddServiceToCart,
  optionIdsFromSnapshot,
} from "@/lib/commerce";
import { getPayloadClient, isPayloadUniqueError, payloadId, withPayloadTransaction } from "@/lib/payload-native";

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

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>;
type CartMutationResult = { count: number };

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
  if (!Number.isInteger(number) || number < 1 || number > MAX_CART_QUANTITY) throw new CartOperationError("invalidQuantity");
  return number;
}

async function findOwnedCart(payload: PayloadClient, userId: string, req?: PayloadRequest) {
  const result = await payload.find({
    collection: "orders",
    depth: 0,
    limit: 1,
    sort: "-createdAt",
    overrideAccess: true,
    ...(req ? { req } : {}),
    where: { and: [{ userId: { equals: userId } }, { status: { equals: "cart" } }] },
  });
  return (result.docs[0] as any) ?? null;
}

async function findOwnedCartWithItems(payload: PayloadClient, userId: string, req?: PayloadRequest) {
  const cart = await findOwnedCart(payload, userId, req);
  if (!cart) return null;
  const items = await payload.find({
    collection: "order-items",
    depth: 0,
    pagination: false,
    sort: "id",
    overrideAccess: true,
    ...(req ? { req } : {}),
    where: { orderId: { equals: cart.id } },
  });
  return { ...cart, items: items.docs as any[] };
}

async function getOrCreateOwnedCart(payload: PayloadClient, req: PayloadRequest, userId: string) {
  const existing = await findOwnedCartWithItems(payload, userId, req);
  if (existing) return existing;
  const cart = await payload.create({
    collection: "orders",
    data: { userId, status: "cart", cartKey: userId },
    depth: 0,
    overrideAccess: true,
    req,
  });
  return { ...cart, items: [] as any[] };
}

async function syncEstimatedAmount(payload: PayloadClient, req: PayloadRequest, orderId: string): Promise<number> {
  const result = await payload.find({
    collection: "order-items",
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
    where: { orderId: { equals: orderId } },
  });
  const items = result.docs as any[];
  const estimatedAmount = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  await payload.update({ collection: "orders", id: orderId, data: { estimatedAmount }, overrideAccess: true, req });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

async function findService(payload: PayloadClient, req: PayloadRequest, id: string) {
  const result = await payload.find({
    collection: "services",
    depth: 2,
    limit: 1,
    overrideAccess: true,
    req,
    where: { id: { equals: id } },
  });
  return (result.docs[0] as any) ?? null;
}
async function findProduct(payload: PayloadClient, req: PayloadRequest, id: string) {
  const result = await payload.find({
    collection: "products",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { id: { equals: id } },
  });
  return (result.docs[0] as any) ?? null;
}
async function findLine(payload: PayloadClient, req: PayloadRequest, where: Record<string, unknown>) {
  const result = await payload.find({
    collection: "order-items",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: where as any,
  });
  return (result.docs[0] as any) ?? null;
}
async function writeActivity(payload: PayloadClient, req: PayloadRequest, data: { action: string; entityId: string; title: string; actorId: string }) {
  await payload.create({
    collection: "activity-logs",
    data: { ...data, entityType: "order" },
    overrideAccess: true,
    req,
  });
}

export async function addCartItem(
  userId: string,
  input: { itemType: "service" | "product"; itemId: string; quantity?: number; optionIds?: string[] },
): Promise<CartMutationResult> {
  if (!validId(userId) || !validId(input.itemId)) throw new CartOperationError("itemUnavailable");
  const quantity = normalizeAddQuantity(input.quantity);
  const payload = await getPayloadClient();
  return withPayloadTransaction(payload, async (req) => {
    const cart = await getOrCreateOwnedCart(payload, req, userId);
    if (input.itemType === "service") {
      const service = await findService(payload, req, input.itemId);
      if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
      const estimate = calculateServiceSelection(service, input.optionIds ?? []);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      const optionsSnapshot = JSON.stringify(estimate.selected);
      const existing = await findLine(payload, req, {
        and: [{ orderId: { equals: cart.id } }, { itemType: { equals: "service" } }, { itemId: { equals: service.id } }, { optionsSnapshot: { equals: optionsSnapshot } }],
      });
      const nextQuantity = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + quantity);
      if (existing) {
        await payload.update({ collection: "order-items", id: existing.id, data: { quantity: nextQuantity, title: service.title, estimatedUnitPrice: estimate.estimatedAmount }, overrideAccess: true, req });
      } else {
        await payload.create({
          collection: "order-items",
          data: { orderId: cart.id, itemType: "service", itemId: service.id, serviceId: service.id, title: service.title, quantity, estimatedUnitPrice: estimate.estimatedAmount, optionsSnapshot },
          overrideAccess: true,
          req,
        });
      }
    } else {
      const product = await findProduct(payload, req, input.itemId);
      if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
      const existing = await findLine(payload, req, {
        and: [{ orderId: { equals: cart.id } }, { itemType: { equals: "product" } }, { itemId: { equals: product.id } }],
      });
      const nextQuantity = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + quantity);
      if (!canAddProductToCart(product, nextQuantity)) throw new CartOperationError("insufficientStock");
      const estimatedUnitPrice = Math.round(product.price * 100);
      if (existing) {
        await payload.update({ collection: "order-items", id: existing.id, data: { quantity: nextQuantity, title: product.name, estimatedUnitPrice }, overrideAccess: true, req });
      } else {
        await payload.create({
          collection: "order-items",
          data: { orderId: cart.id, itemType: "product", itemId: product.id, productId: product.id, title: product.name, quantity, estimatedUnitPrice, optionsSnapshot: "[]" },
          overrideAccess: true,
          req,
        });
      }
    }
    return { count: await syncEstimatedAmount(payload, req, cart.id) };
  });
}

export async function updateOwnedCartItem(userId: string, input: { id: string; quantity: number }): Promise<CartMutationResult> {
  if (!validId(input.id)) throw new CartOperationError("cartItemNotFound");
  const quantity = normalizeExactQuantity(input.quantity);
  const payload = await getPayloadClient();
  return withPayloadTransaction(payload, async (req) => {
    const cart = await findOwnedCart(payload, userId, req);
    if (!cart) throw new CartOperationError("cartItemNotFound");
    const line = await findLine(payload, req, { and: [{ id: { equals: input.id } }, { orderId: { equals: cart.id } }] });
    if (!line) throw new CartOperationError("cartItemNotFound");
    if (line.itemType === "service") {
      const service = await findService(payload, req, line.itemId || payloadId(line.serviceId) || "");
      if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
      const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
      const estimate = optionIds === null ? null : calculateServiceSelection(service, optionIds);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      await payload.update({ collection: "order-items", id: line.id, data: { quantity, title: service.title, estimatedUnitPrice: estimate.estimatedAmount, optionsSnapshot: JSON.stringify(estimate.selected) }, overrideAccess: true, req });
    } else if (line.itemType === "product") {
      const product = await findProduct(payload, req, line.itemId || payloadId(line.productId) || "");
      if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
      if (!canAddProductToCart(product, quantity)) throw new CartOperationError("insufficientStock");
      await payload.update({ collection: "order-items", id: line.id, data: { quantity, title: product.name, estimatedUnitPrice: Math.round(product.price * 100) }, overrideAccess: true, req });
    } else throw new CartOperationError("itemUnavailable");
    return { count: await syncEstimatedAmount(payload, req, cart.id) };
  });
}

export async function removeOwnedCartItem(userId: string, id: string): Promise<CartMutationResult> {
  if (!validId(id)) throw new CartOperationError("cartItemNotFound");
  const payload = await getPayloadClient();
  return withPayloadTransaction(payload, async (req) => {
    const cart = await findOwnedCart(payload, userId, req);
    if (!cart) return { count: 0 };
    const removed = await payload.delete({ collection: "order-items", where: { and: [{ id: { equals: id } }, { orderId: { equals: cart.id } }] }, overrideAccess: true, req });
    if (removed.docs.length === 0) throw new CartOperationError("cartItemNotFound");
    return { count: await syncEstimatedAmount(payload, req, cart.id) };
  });
}

function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const candidate = new Date(raw);
  if (Number.isNaN(candidate.getTime())) throw new CartOperationError("invalidDeadline");
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

export async function checkoutOwnedCart(
  userId: string,
  input: { note?: string | null; deadline?: string | null } = {},
): Promise<{ orderNumber: string }> {
  const deadline = parseDeadline(input.deadline);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 4000) : "";
  const payload = await getPayloadClient();
  const baseCount = await payload.count({ collection: "orders", overrideAccess: true, where: { status: { not_equals: "cart" } } });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = orderNumber(baseCount.totalDocs + 1 + attempt);
    try {
      return await withPayloadTransaction(payload, async (req) => {
        const cart = await findOwnedCartWithItems(payload, userId, req);
        if (!cart || cart.items.length === 0) throw new CartOperationError("cartEmpty");
        const serviceIds = [...new Set(cart.items.filter((item) => item.itemType === "service").map((item) => item.itemId || payloadId(item.serviceId) || "").filter(Boolean))];
        const productIds = [...new Set(cart.items.filter((item) => item.itemType === "product").map((item) => item.itemId || payloadId(item.productId) || "").filter(Boolean))];
        const [serviceResult, productResult] = await Promise.all([
          serviceIds.length ? payload.find({ collection: "services", depth: 2, pagination: false, overrideAccess: true, req, where: { id: { in: serviceIds } } }) : Promise.resolve({ docs: [] }),
          productIds.length ? payload.find({ collection: "products", depth: 0, pagination: false, overrideAccess: true, req, where: { id: { in: productIds } } }) : Promise.resolve({ docs: [] }),
        ]);
        const services = serviceResult.docs as any[];
        const products = productResult.docs as any[];
        const serviceMap = new Map(services.map((service) => [service.id, service]));
        const productMap = new Map(products.map((product) => [product.id, product]));
        const productQuantities = new Map<string, number>();
        for (const line of cart.items) {
          if (line.itemType !== "product") continue;
          const id = line.itemId || payloadId(line.productId) || "";
          productQuantities.set(id, (productQuantities.get(id) ?? 0) + line.quantity);
        }
        for (const [id, quantity] of productQuantities) {
          const product = productMap.get(id);
          if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
          if (!canAddProductToCart(product, quantity)) throw new CartOperationError("insufficientStock");
        }

        let estimatedAmount = 0;
        const serviceQuantities = new Map<string, number>();
        const refreshedTitles: string[] = [];
        for (const line of cart.items) {
          if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_CART_QUANTITY) throw new CartOperationError("invalidQuantity");
          if (line.itemType === "service") {
            const id = line.itemId || payloadId(line.serviceId) || "";
            const service = serviceMap.get(id);
            if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
            const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
            const estimate = optionIds === null ? null : calculateServiceSelection(service, optionIds);
            if (!estimate) throw new CartOperationError("incompleteOptions");
            estimatedAmount += estimate.estimatedAmount * line.quantity;
            serviceQuantities.set(id, (serviceQuantities.get(id) ?? 0) + line.quantity);
            refreshedTitles.push(service.title);
            await payload.update({ collection: "order-items", id: line.id, data: { title: service.title, estimatedUnitPrice: estimate.estimatedAmount, optionsSnapshot: JSON.stringify(estimate.selected) }, overrideAccess: true, req });
          } else if (line.itemType === "product") {
            const id = line.itemId || payloadId(line.productId) || "";
            const product = productMap.get(id);
            if (!product) throw new CartOperationError("itemUnavailable");
            const unitEstimate = Math.round(product.price * 100);
            estimatedAmount += unitEstimate * line.quantity;
            refreshedTitles.push(product.name);
            await payload.update({ collection: "order-items", id: line.id, data: { title: product.name, estimatedUnitPrice: unitEstimate }, overrideAccess: true, req });
          } else throw new CartOperationError("itemUnavailable");
        }

        await payload.delete({ collection: "order-services", where: { orderId: { equals: cart.id } }, overrideAccess: true, req });
        for (const [serviceId, quantity] of serviceQuantities) {
          await payload.create({ collection: "order-services", data: { orderId: cart.id, serviceId, quantity }, overrideAccess: true, req });
        }
        const transitioned = await payload.update({
          collection: "orders",
          data: { status: "pending", cartKey: null, orderNumber: number, number, deadline: deadline?.toISOString() ?? null, description: note || null, customerNote: note || null, estimatedAmount },
          overrideAccess: true,
          req,
          where: { and: [{ id: { equals: cart.id } }, { userId: { equals: userId } }, { status: { equals: "cart" } }] },
        });
        if (transitioned.docs.length !== 1) throw new CartOperationError("staleCart");
        await writeActivity(payload, req, { action: "create", entityId: cart.id, title: `${number} — ${refreshedTitles.join(", ").slice(0, 180)}`, actorId: userId });
        return { orderNumber: number };
      });
    } catch (error) {
      if (error instanceof CartOperationError) throw error;
      if (!isPayloadUniqueError(error) || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to allocate an order number");
}
